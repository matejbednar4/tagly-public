import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { REWARD_TAKES } from "../../../../../constants/rewards/PRICING.js";
import { AnyNumber } from "../../helpers/types.js";
import { bpsOfCents } from "../../../../formatting/bpsOfCents.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { findReferrer } from "../../../../referrals/findReferrer.js";
import { createReferralPayoutEvent } from "../createReferralPayoutEvent.js";

/**
 * Settle an advertiser-funded share: pay the customer the FULL gross price,
 * consuming the SHARE_LOCK first and drawing whatever remains from the
 * advertiser's available budget — **even past zero**. A negative
 * `availableBudgetUsdCents` is the advertiser receivable, netted off by their
 * next credit purchase (or next PAYG card charge, whose shortfall is computed
 * against the negative balance).
 *
 * POLICY (Matej, 2026-08-01 — E069): advertiser-funded settles never shortfall
 * the customer. The old cap-at-available behavior existed to keep prepaid
 * advertisers at ≥ $0, but it also meant an unrelated PAYG receivable (negative
 * available) silently underpaid — or terminally voided — a customer whose money
 * was locked for exactly their share. Advertisers historically always top up
 * ($50 minimum), the gap past the 1.5× lock is usually small, and a guaranteed
 * full payout is the better product: the platform fronts the payout and carries
 * the receivable. `shortfall`/`capReason` are kept in the return shape for the
 * settle contract (subsidized settles still cap at the platform balance) but
 * are always `0n`/`null` here.
 */
export async function settleSharePayoutAndUnlockRemainder(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId: number;
    customerId: number;
    shareId: number;
    grossPriceCents: AnyNumber; // amount advertiser is supposed to pay
    meta?: Prisma.InputJsonObject;
    /**
     * Currency to settle in when the share has NO SHARE_LOCK (lock-less PAYG).
     * Ignored when a lock exists (the lock's currency is authoritative). Without
     * a lock and without this, settlement throws 1608.
     */
    currencyOverride?: string;
  }
): Promise<{
  payout?: TransactionLedgerEvent; // SHARE_PAYMENT (undefined if zero price)
  unlockRemainder?: TransactionLedgerEvent; // UNLOCK (if any remainder)
  actualGrossPaid: bigint;
  usedFromLock: bigint;
  topUpFromAvailable: bigint;
  remainderUnlocked: bigint;
  /** Always 0n — advertiser settles pay in full (see the docblock). */
  shortfall: bigint;
  /** Always null here; the type is shared with the subsidized settle contract. */
  capReason: "LOW_BUDGET" | "OVER_LOCK" | null;
  created: boolean; // false if payment idempotently existed
}> {
  const { advertiserId, customerId, shareId, meta, currencyOverride } = input;

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1601, "advertiserId required", 400);
  }
  if (!customerId || customerId <= 0) {
    throw createCustomError(1602, "customerId required", 400);
  }
  if (!shareId || shareId <= 0) {
    throw createCustomError(1603, "shareId required", 400);
  }

  const desiredGross = asBigInt(input.grossPriceCents);
  if (desiredGross < 0n) {
    throw createCustomError(1604, "finalPrice must be > 0", 400);
  }

  // Source-of-truth: read currency from the original SHARE_LOCK event for
  // this share. The settle (and any remainder unlock) must use the same
  // currency the lock was recorded in so the advertiser's currency-tagged
  // budget column is correctly reversed.
  const lockEvent = await tx.transactionLedgerEvent.findFirst({
    where: { shareId, advertiserId, kind: TransactionKind.SHARE_LOCK },
    select: { deltaAdvertiserLockedCents: true, currency: true },
  });
  const lockedForShare = lockEvent?.deltaAdvertiserLockedCents ?? 0n;
  // Lock currency is authoritative; fall back to the explicit override for
  // lock-less PAYG shares (which settle entirely from available + card top-up).
  const currency = lockEvent?.currency ?? currencyOverride;

  if (!currency) {
    // No SHARE_LOCK and no override — settlement before lock is a flow violation.
    throw createCustomError(
      1608,
      "no SHARE_LOCK event found and no currency override for share",
      500,
    );
  }

  // Spend order: consume lock first, then draw the rest from available — in
  // full, even past zero (negative available = the advertiser receivable; see
  // the docblock). The customer is always paid the full gross.
  const usedFromLock =
    lockedForShare < desiredGross ? lockedForShare : desiredGross;
  const topUpFromAvailable = desiredGross - usedFromLock;
  const actualGrossPaid = desiredGross;
  const remainderLockedAfterPayout = lockedForShare - usedFromLock;
  const shortfall = 0n;
  const capReason: "LOW_BUDGET" | "OVER_LOCK" | null = null;

  // Zero-price case: skip SHARE_PAYMENT, only unlock any locked funds
  if (actualGrossPaid === 0n) {
    let unlockRemainder: TransactionLedgerEvent | undefined;
    let remainderUnlocked = 0n;

    if (lockedForShare > 0n) {
      const unlockRef = `share:${shareId}:unlock-remainder:v1`;

      const existingUnlock = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef: unlockRef,
            kind: TransactionKind.SHARE_UNLOCK,
          },
        },
      });

      if (existingUnlock) {
        unlockRemainder = existingUnlock;
      } else {
        remainderUnlocked = lockedForShare;

        unlockRemainder = await createLedgerEvent(tx, {
          kind: TransactionKind.SHARE_UNLOCK,
          currency,
          advertiserId,
          shareId,
          deltaAdvertiserLockedCents: -remainderUnlocked,
          deltaAdvertiserCents: remainderUnlocked,
          externalRef: unlockRef,
          enforceZeroSum: true,
          idempotentOnExternalRef: true,
        });
      }
    }

    return {
      payout: undefined,
      unlockRemainder,
      actualGrossPaid: 0n,
      usedFromLock: 0n,
      topUpFromAvailable: 0n,
      remainderUnlocked,
      shortfall: 0n,
      capReason: null,
      created: true,
    };
  }

  // Idempotency for payment
  const paymentRef = `share:${shareId}:payment:v1`;
  const existingPayment = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: {
        externalRef: paymentRef,
        kind: TransactionKind.SHARE_PAYMENT,
      },
    },
  });
  if (existingPayment) {
    // Try to fetch an existing unlock (optional)
    let unlockEvt: TransactionLedgerEvent | undefined;
    if (remainderLockedAfterPayout > 0n) {
      const unlockRef = `share:${shareId}:unlock-remainder:v1`;
      unlockEvt =
        (await tx.transactionLedgerEvent.findUnique({
          where: {
            externalRef_kind: {
              externalRef: unlockRef,
              kind: TransactionKind.SHARE_UNLOCK,
            },
          },
        })) ?? undefined;
    }
    return {
      payout: existingPayment,
      unlockRemainder: unlockEvt,
      actualGrossPaid,
      usedFromLock,
      topUpFromAvailable,
      remainderUnlocked: 0n,
      shortfall,
      capReason,
      created: false,
    };
  }

  // Compute fee + referral bonuses
  const platformFee = bpsOfCents(
    actualGrossPaid,
    REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS
  );

  const advertiserReferrer = await findReferrer({ tx, advertiserId });
  const customerReferrer = await findReferrer({ tx, customerId });

  let advRefBonus = 0n;
  if (advertiserReferrer !== null) {
    advRefBonus = bpsOfCents(platformFee, advertiserReferrer.referrerBps);
  }

  let custRefBonus = 0n;
  if (customerReferrer !== null) {
    custRefBonus = bpsOfCents(platformFee, customerReferrer.referrerBps);
  }

  const totalRefBonus = advRefBonus + custRefBonus;
  if (totalRefBonus > platformFee) {
    throw createCustomError(1607, "referrer cuts exceed platform fee", 500);
  }

  let customerNet = actualGrossPaid - platformFee;
  if (customerNet < 0n) {
    customerNet = 0n;
  }

  // SHARE_PAYMENT: book sale to customer, consume lock/available, book FULL platform fee
  let payout: TransactionLedgerEvent;
  try {
    payout = await createLedgerEvent(tx, {
      kind: TransactionKind.SHARE_PAYMENT,
      currency,

      advertiserId,
      deltaAdvertiserLockedCents: -usedFromLock,
      deltaAdvertiserCents: -(actualGrossPaid - usedFromLock),

      customerId,
      deltaCustomerCents: customerNet,

      shareId,
      grossSharePriceCents: actualGrossPaid,

      // book full fee here; referral payouts will offset this in separate events
      deltaPlatformCents: platformFee,

      externalRef: paymentRef,
      meta: {
        ...(meta ?? {}),
        desiredGrossCents: desiredGross.toString(),
        actualGrossPaidCents: actualGrossPaid.toString(),
        usedFromLockCents: usedFromLock.toString(),
        topUpFromAvailableCents: topUpFromAvailable.toString(),
        shortfallCents: shortfall.toString(),
        platformFeeBps: REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS,
        advRefCutBps: advertiserReferrer?.referrerBps,
        custRefCutBps: customerReferrer?.referrerBps,
      },

      enforceZeroSum: true,
      idempotentOnExternalRef: true,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef: paymentRef,
            kind: TransactionKind.SHARE_PAYMENT,
          },
        },
      });
      if (again) {
        return {
          payout: again,
          actualGrossPaid,
          usedFromLock,
          topUpFromAvailable,
          remainderUnlocked: 0n,
          shortfall,
          capReason,
          created: false,
        };
      }
    }
    throw err;
  }

  // REFERRALS
  // Advertiser-side referrer payout - whoever referred the advertiser
  if (advRefBonus > 0n && advertiserReferrer !== null) {
    const advRefExternalRef = `share:${shareId}:referral:adv:v1`;

    let referrerAdvertiserId: number | null = null;
    if (advertiserReferrer.referrer.type === "advertiser") {
      referrerAdvertiserId = advertiserReferrer.referrer.id;
    }
    let referrerCustomerId: number | null = null;
    if (advertiserReferrer.referrer.type === "customer") {
      referrerCustomerId = advertiserReferrer.referrer.id;
    }

    await createReferralPayoutEvent(tx, {
      shareId,
      amountCents: advRefBonus,
      currency,
      advertiserId: referrerAdvertiserId ?? undefined,
      customerId: referrerCustomerId ?? undefined,
      externalRef: advRefExternalRef,
      meta: {
        ...(meta ?? {}),
        source: "advertiser-referrer",
        referralEventId: advertiserReferrer.referrerEventId,
      },
    });
  }

  // Customer-side referrer payout - whoever referred the customer
  if (custRefBonus > 0n && customerReferrer !== null) {
    const custRefExternalRef = `share:${shareId}:referral:cust:v1`;

    let referrerAdvertiserId: number | null = null;
    if (customerReferrer.referrer.type === "advertiser") {
      referrerAdvertiserId = customerReferrer.referrer.id;
    }
    let referrerCustomerId: number | null = null;
    if (customerReferrer.referrer.type === "customer") {
      referrerCustomerId = customerReferrer.referrer.id;
    }

    await createReferralPayoutEvent(tx, {
      shareId,
      amountCents: custRefBonus,
      currency,
      advertiserId: referrerAdvertiserId ?? undefined,
      customerId: referrerCustomerId ?? undefined,
      externalRef: custRefExternalRef,
      meta: {
        ...(meta ?? {}),
        source: "customer-referrer",
        referralEventId: customerReferrer.referrerEventId,
      },
    });
  }

  // UNLOCK remainder, if any
  let unlockRemainder: TransactionLedgerEvent | undefined;
  let remainderUnlocked = 0n;

  if (remainderLockedAfterPayout > 0n) {
    const unlockRef = `share:${shareId}:unlock-remainder:v1`;

    const existingUnlock = await tx.transactionLedgerEvent.findUnique({
      where: {
        externalRef_kind: {
          externalRef: unlockRef,
          kind: TransactionKind.SHARE_UNLOCK,
        },
      },
    });

    if (existingUnlock) {
      unlockRemainder = existingUnlock;
    } else {
      remainderUnlocked = remainderLockedAfterPayout;

      unlockRemainder = await createLedgerEvent(tx, {
        kind: TransactionKind.SHARE_UNLOCK,
        currency,
        advertiserId,
        shareId,
        deltaAdvertiserLockedCents: -remainderUnlocked,
        deltaAdvertiserCents: remainderUnlocked,
        externalRef: unlockRef,
        enforceZeroSum: true,
        idempotentOnExternalRef: true,
      });
    }
  }

  return {
    payout,
    unlockRemainder,
    actualGrossPaid,
    usedFromLock,
    topUpFromAvailable,
    remainderUnlocked,
    shortfall,
    capReason,
    created: true,
  };
}
