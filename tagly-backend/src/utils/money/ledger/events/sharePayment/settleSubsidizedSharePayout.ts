import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { AnyNumber } from "../../helpers/types.js";
import { bpsOfCents } from "../../../../formatting/bpsOfCents.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { createReferralPayoutEvent } from "../createReferralPayoutEvent.js";
import { findReferrer } from "../../../../referrals/findReferrer.js";
import { REWARD_TAKES } from "../../../../../constants/rewards/PRICING.js";
import { retrieveAvailableStripeBalance } from "../../../stripe/retrieveAvailableStripeBalance.js";

/**
 * Settles a subsidized share payout.
 *
 * No advertiser, no platform fee retained — the platform funds the full
 * finalPriceCents to the customer. finalPriceCents is already net (40% take
 * was baked into the price at calculation time, not deducted here).
 *
 * If available Stripe balance is insufficient, only what is affordable is paid
 * (shortfall tracked in ledger meta; callers stamp `capReason: PLATFORM_BALANCE`).
 * This is deliberately the ONE settle path that still caps instead of paying in
 * full (E069 policy exempts it): the platform pool has no counterparty to hold
 * a receivable against. A negative unassigned balance clamps to 0 — a settle
 * must never debit the customer.
 *
 * Flow:
 * 1. Aggregate platform lock for this share
 * 2. Check Stripe balance to determine actual payable amount
 * 3. Pay customer up to finalPriceCents (SHARE_PAYMENT)
 * 4. Pay customer referrer bonus out of platform (REFERRAL_PAYOUT)
 * 5. Unlock any lock remainder (SHARE_UNLOCK)
 */
export async function settleSubsidizedSharePayout(
  tx: Prisma.TransactionClient,
  input: {
    customerId: number;
    shareId: number;
    finalPriceCents: AnyNumber;
    meta?: Prisma.InputJsonObject;
  }
): Promise<{
  payout?: TransactionLedgerEvent;
  unlockRemainder?: TransactionLedgerEvent;
  // What the platform actually paid the customer, and the shortfall vs the full
  // price (>0 only when the platform Stripe balance couldn't cover it). Callers
  // stamp these onto FinalPrice (`settledGrossCents` + a "PLATFORM_BALANCE"
  // capReason when short).
  actualPaid: bigint;
  shortfall: bigint;
  created: boolean;
}> {
  const { customerId, shareId, meta } = input;
  const finalPriceCents = asBigInt(input.finalPriceCents);

  if (!customerId || customerId <= 0) {
    throw createCustomError(1620, "customerId required", 400);
  }
  if (!shareId || shareId <= 0) {
    throw createCustomError(1621, "shareId required", 400);
  }
  if (finalPriceCents < 0n) {
    throw createCustomError(1622, "finalPriceCents must be >= 0", 400);
  }

  // Source-of-truth: read currency from the subsidized SHARE_LOCK event so
  // both the payout and any remainder unlock target the same currency-tagged
  // platform balance column.
  const lockEvent = await tx.transactionLedgerEvent.findFirst({
    where: { shareId, kind: TransactionKind.SHARE_LOCK },
    select: { deltaPlatformLockedCents: true, currency: true },
  });
  const lockedForShare = lockEvent?.deltaPlatformLockedCents ?? 0n;
  const currency = lockEvent?.currency;

  if (!currency) {
    throw createCustomError(
      1623,
      "no SHARE_LOCK event found for subsidized share",
      500,
    );
  }

  const paymentRef = `share:${shareId}:payment:v1`;

  // Idempotency
  const existingPayment = await tx.transactionLedgerEvent.findUnique({
    where: { externalRef_kind: { externalRef: paymentRef, kind: TransactionKind.SHARE_PAYMENT } },
  });
  if (existingPayment) {
    // The customer credit on the prior SHARE_PAYMENT is the actual paid amount.
    const paid = existingPayment.deltaCustomerCents;
    return {
      payout: existingPayment,
      actualPaid: paid,
      shortfall: finalPriceCents - paid,
      created: false,
    };
  }

  // Zero-price: skip SHARE_PAYMENT, only unlock any lock
  if (finalPriceCents === 0n) {
    let unlockRemainder: TransactionLedgerEvent | undefined;
    if (lockedForShare > 0n) {
      unlockRemainder = await createLedgerEvent(tx, {
        kind: TransactionKind.SHARE_UNLOCK,
        shareId,
        currency,
        deltaPlatformCents: lockedForShare,
        deltaPlatformLockedCents: -lockedForShare,
        externalRef: `share:${shareId}:unlock-remainder:v1`,
        enforceZeroSum: true,
        idempotentOnExternalRef: true,
      });
    }
    return {
      payout: undefined,
      unlockRemainder,
      actualPaid: 0n,
      shortfall: 0n,
      created: true,
    };
  }

  // Consume lock first. Only check Stripe if there is a shortfall after the lock.
  const usedFromLock = lockedForShare < finalPriceCents ? lockedForShare : finalPriceCents;
  const lockShortfall = finalPriceCents - usedFromLock;

  let topUpFromAvailable = 0n;
  if (lockShortfall > 0n) {
    // Lock is insufficient — check unassigned Stripe balance for top-up.
    // retrieveAvailableStripeBalance already subtracts PlatformBalance.lockedCents,
    // so unassignedCents is the true free balance (our lock is not in it).
    // Clamp at 0: unassignedCents can go NEGATIVE (the real Stripe balance
    // dipping below assigned liabilities), and an unclamped negative here would
    // subtract from the lock-funded portion — underpaying, or with a deep enough
    // negative even DEBITING, the customer (E069).
    const { unassignedCents } = await retrieveAvailableStripeBalance(tx);
    const stripeAvailable = unassignedCents > 0 ? BigInt(unassignedCents) : 0n;
    topUpFromAvailable = stripeAvailable < lockShortfall ? stripeAvailable : lockShortfall;
  }

  const actualPaid = usedFromLock + topUpFromAvailable;
  if (actualPaid < 0n) {
    // Unreachable post-clamp — kept as a hard stop so no future regression can
    // ever write a negative deltaCustomerCents (a customer DEBIT) here.
    throw createCustomError(1624, "subsidized settle computed a negative payout", 500);
  }
  const shortfall = finalPriceCents - actualPaid;
  const remainder = lockedForShare - usedFromLock;

  let payout: TransactionLedgerEvent;
  try {
    payout = await createLedgerEvent(tx, {
      kind: TransactionKind.SHARE_PAYMENT,
      currency,
      customerId,
      shareId,

      // Customer receives the actual paid amount
      deltaCustomerCents: actualPaid,

      // Release the consumed portion of the lock.
      // deltaPlatformCents only covers the top-up from unassigned Stripe balance —
      // the locked portion was already debited at lock time (deltaPlatformCents: -lockCents).
      deltaPlatformLockedCents: -usedFromLock,
      deltaPlatformCents: -topUpFromAvailable,

      grossSharePriceCents: finalPriceCents,
      externalRef: paymentRef,
      meta: {
        ...(meta ?? {}),
        finalPriceCents: finalPriceCents.toString(),
        actualPaidCents: actualPaid.toString(),
        lockedForShare: lockedForShare.toString(),
        usedFromLock: usedFromLock.toString(),
        shortfallCents: shortfall.toString(),
        subsidized: true,
      },
      enforceZeroSum: true,
      idempotentOnExternalRef: false,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: { externalRef_kind: { externalRef: paymentRef, kind: TransactionKind.SHARE_PAYMENT } },
      });
      if (again) {
        const paid = again.deltaCustomerCents;
        return {
          payout: again,
          actualPaid: paid,
          shortfall: finalPriceCents - paid,
          created: false,
        };
      }
    }
    throw err;
  }

  // Customer referrer payout — funded by the platform on top of actualPaid.
  // platformFeeEquivalent reconstructs what the platform fee would have been on the
  // gross price: finalPriceCents = gross × 60%, so fee = finalPriceCents × (40/60).
  // No advertiser referrer — subsidized locals have no advertiser.
  const customerReferrer = await findReferrer({ tx, customerId });
  if (customerReferrer !== null) {
    const platformFeeEquivalent =
      (actualPaid * BigInt(REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS)) /
      BigInt(10_000 - REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS);

    const custRefBonus = bpsOfCents(platformFeeEquivalent, customerReferrer.referrerBps);

    if (custRefBonus > 0n) {
      const referrerCustomerId =
        customerReferrer.referrer.type === "customer" ? customerReferrer.referrer.id : undefined;
      const referrerAdvertiserId =
        customerReferrer.referrer.type === "advertiser" ? customerReferrer.referrer.id : undefined;

      await createReferralPayoutEvent(tx, {
        shareId,
        amountCents: custRefBonus,
        currency,
        customerId: referrerCustomerId,
        advertiserId: referrerAdvertiserId,
        externalRef: `share:${shareId}:referral:cust:v1`,
        meta: {
          ...(meta ?? {}),
          source: "customer-referrer-subsidized",
          referralEventId: customerReferrer.referrerEventId,
        },
      });
    }
  }

  // Unlock remainder if lock exceeded actualPaid
  let unlockRemainder: TransactionLedgerEvent | undefined;
  if (remainder > 0n) {
    unlockRemainder = await createLedgerEvent(tx, {
      kind: TransactionKind.SHARE_UNLOCK,
      shareId,
      currency,
      deltaPlatformCents: remainder,
      deltaPlatformLockedCents: -remainder,
      externalRef: `share:${shareId}:unlock-remainder:v1`,
      enforceZeroSum: true,
      idempotentOnExternalRef: true,
    });
  }

  return { payout, unlockRemainder, actualPaid, shortfall, created: true };
}
