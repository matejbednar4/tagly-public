import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { AnyNumber } from "../../helpers/types.js";
import { getPendingLockedAmount } from "./refundAdvertiserCreditPurchase.js";

/**
 * Unlock budget after a credit-purchase refund fails (locked → available).
 * Reverses a previous CREDIT_PURCHASE_REFUND_LOCK.
 *
 * The unlock is CAPPED at the purchase's still-pending locked amount, recomputed
 * inside this transaction. The `refund.succeeded` webhook books its refund by
 * CONSUMING any pending lock (`refundAdvertiserCreditPurchase`), so when the
 * caller's Stripe call failed ambiguously but the refund actually went through,
 * the webhook may already have spent the lock this unlock targets — a blind
 * unlock would then drive `lockedBudgetUsdCents` negative and restore available
 * the advertiser was also refunded on the card (E021). When nothing is pending,
 * the unlock is skipped (`event: null`, `unlockedCents: 0n`).
 */
export async function unlockBudgetForFailedCreditPurchaseRefund(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId: number;
    unlockCents: AnyNumber;
    stripeCreditPurchaseId: number;
    externalRef: string;
    meta?: Prisma.InputJsonObject;
  }
): Promise<{
  event: TransactionLedgerEvent | null;
  created: boolean;
  /** What was actually released — min(requested, still-pending lock). */
  unlockedCents: bigint;
}> {
  const { advertiserId, stripeCreditPurchaseId, externalRef, meta } = input;
  const requestedAmount = asBigInt(input.unlockCents);

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1711, "advertiserId required", 400);
  }
  if (requestedAmount <= 0n) {
    throw createCustomError(1712, "unlock amount must be > 0", 400);
  }

  // Idempotency check
  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: {
        externalRef,
        kind: TransactionKind.CREDIT_PURCHASE_REFUND_UNLOCK,
      },
    },
  });
  if (existing) {
    return {
      event: existing,
      created: false,
      unlockedCents: -existing.deltaAdvertiserLockedCents,
    };
  }

  // Cap at what is genuinely still locked for this purchase (see docblock).
  const pendingLocked = await getPendingLockedAmount(tx, stripeCreditPurchaseId);
  const unlockAmount =
    pendingLocked < requestedAmount ? pendingLocked : requestedAmount;
  if (unlockAmount <= 0n) {
    // Lock already consumed (webhook won the race) — nothing to release.
    return { event: null, created: false, unlockedCents: 0n };
  }

  // Source-of-truth: currency comes from the StripeCreditPurchase row.
  const creditPurchase = await tx.stripeCreditPurchase.findUnique({
    where: { id: stripeCreditPurchaseId },
    select: { currency: true },
  });
  if (!creditPurchase) {
    throw createCustomError(1713, "stripe credit purchase not found", 404);
  }

  let event: TransactionLedgerEvent;
  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.CREDIT_PURCHASE_REFUND_UNLOCK,
      currency: creditPurchase.currency,
      advertiserId,
      deltaAdvertiserLockedCents: -unlockAmount,
      deltaAdvertiserCents: unlockAmount,
      externalRef,
      meta,
      enforceZeroSum: true,
      idempotentOnExternalRef: false, // handled manually above
      stripeCreditPurchaseId,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef,
            kind: TransactionKind.CREDIT_PURCHASE_REFUND_UNLOCK,
          },
        },
      });
      if (again) {
        return {
          event: again,
          created: false,
          unlockedCents: -again.deltaAdvertiserLockedCents,
        };
      }
    }
    throw err;
  }

  return { event, created: true, unlockedCents: unlockAmount };
}
