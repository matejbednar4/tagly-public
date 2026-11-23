import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { AnyNumber } from "../../helpers/types.js";
import { lockBudgetForCreditPurchaseRefund } from "./lockBudgetForCreditPurchaseRefund.js";

type TxClient = Prisma.TransactionClient;

/**
 * Create a CREDIT_PURCHASE_REFUND event with idempotency on (externalRef, kind).
 *
 * Always follows a lock → refund flow:
 * 1. Ensures funds are locked via CREDIT_PURCHASE_REFUND_LOCK (creates one if
 *    not already present from an admin-initiated flow)
 * 2. Creates CREDIT_PURCHASE_REFUND that deducts from locked budget
 *
 * This keeps the ledger pattern uniform regardless of whether the refund was
 * initiated by an admin (pre-locked) or a Stripe webhook (auto-locked here).
 */
export async function refundAdvertiserCreditPurchase(
  tx: TxClient,
  input: {
    advertiserId: number;
    refundCents: AnyNumber; // must be > 0 (we'll store as negative delta)
    creditPurchaseUid: string;
    stripePaymentIntentId: string;
    stripeRefundId?: string;
    /**
     * A chargeback (`charge.dispute.*`, E066) has no Refund object — pass the
     * dispute id instead and the event books under `stripe_dispute_{id}`, so a
     * dispute clawback and a regular refund of the same purchase can never
     * collide on externalRef.
     */
    stripeDisputeId?: string;
    meta?: Prisma.InputJsonObject;
    enforceBalance?: boolean; // true = require sufficient available budget for lock; false = allow negative (webhook flows)
    stripeCreditPurchaseId: number;
  },
): Promise<{ event: TransactionLedgerEvent; created: boolean }> {
  const {
    advertiserId,
    creditPurchaseUid,
    stripePaymentIntentId,
    stripeRefundId,
    stripeDisputeId,
    meta,
    enforceBalance = false,
    stripeCreditPurchaseId,
  } = input;

  const refundAbs = asBigInt(input.refundCents);
  const delta = -refundAbs; // negative: money leaving advertiser locked balance

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1321, "advertiserId required", 400);
  }
  if (!creditPurchaseUid || creditPurchaseUid.trim().length === 0) {
    throw createCustomError(1320, "creditPurchaseUid required", 400);
  }
  if (!stripePaymentIntentId || stripePaymentIntentId.trim().length === 0) {
    throw createCustomError(1327, "stripePaymentIntentId required", 400);
  }
  if (refundAbs <= 0n) {
    throw createCustomError(1322, "refund must be > 0", 400);
  }

  // Build externalRef internally (no externalRef in public API)
  const externalRef = stripeDisputeId
    ? `stripe_dispute_${stripeDisputeId}`
    : stripeRefundId
      ? `stripe_refund_${stripeRefundId}`
      : `credit_purchase_refund_${stripePaymentIntentId}`;

  // Idempotency: has this refund already been recorded?
  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: {
        externalRef,
        kind: TransactionKind.CREDIT_PURCHASE_REFUND,
      },
    },
  });

  if (existing) {
    return { event: existing, created: false };
  }

  // Step 1: Ensure funds are locked.
  // Check how much is already locked (minus consumed refunds and unlocks).
  const pendingLocked = await getPendingLockedAmount(
    tx,
    stripeCreditPurchaseId,
  );

  if (pendingLocked < refundAbs) {
    // Need to lock the shortfall (or the full amount if no prior lock)
    const shortfall = refundAbs - (pendingLocked > 0n ? pendingLocked : 0n);

    const lockRef = stripeDisputeId
      ? `refund_lock:${stripeCreditPurchaseId}:${stripeDisputeId}`
      : stripeRefundId
        ? `refund_lock:${stripeCreditPurchaseId}:${stripeRefundId}`
        : `refund_lock:${stripeCreditPurchaseId}:${stripePaymentIntentId}`;

    await lockBudgetForCreditPurchaseRefund(tx, {
      advertiserId,
      lockCents: shortfall,
      stripeCreditPurchaseId,
      externalRef: lockRef,
      requireSufficientAvailable: enforceBalance,
      meta: {
        creditPurchaseUid,
        autoLocked: true, // marks this was auto-created, not admin-initiated
      },
    });
  }

  // Step 2: Create the refund event — always from locked budget
  // Merge creditPurchaseUid into meta so we can aggregate later.
  // Stripe IDs stay inside the nested `stripe` object (passed via meta) to avoid duplication.
  const mergedMeta: Prisma.InputJsonObject | undefined = {
    ...(meta as any),
    creditPurchaseUid,
  };

  // Source-of-truth: currency comes from the StripeCreditPurchase row.
  const creditPurchase = await tx.stripeCreditPurchase.findUnique({
    where: { id: stripeCreditPurchaseId },
    select: { currency: true },
  });
  if (!creditPurchase) {
    throw createCustomError(1328, "stripe credit purchase not found", 404);
  }

  let event: TransactionLedgerEvent;
  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.CREDIT_PURCHASE_REFUND,
      currency: creditPurchase.currency,
      advertiserId,
      deltaAdvertiserLockedCents: delta, // always from locked
      externalRef,
      meta: mergedMeta,
      enforceZeroSum: false,
      idempotentOnExternalRef: false, // handled manually here
      stripeCreditPurchaseId,
    });
  } catch (err: any) {
    // Handle race on unique(externalRef, kind)
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef,
            kind: TransactionKind.CREDIT_PURCHASE_REFUND,
          },
        },
      });
      if (again) {
        return { event: again, created: false };
      }
    }
    throw err;
  }

  return { event, created: true };
}

/**
 * Get the net amount currently locked for refund on a credit purchase
 * (total locks - consumed refunds from locked - unlocks).
 *
 * Exported because `unlockBudgetForFailedCreditPurchaseRefund` caps its unlock
 * at this figure — the webhook's refund booking consumes pending locks, so an
 * unlock computed from anything else can double-release (E021).
 */
export async function getPendingLockedAmount(
  tx: TxClient,
  stripeCreditPurchaseId: number,
): Promise<bigint> {
  // Total locked via CREDIT_PURCHASE_REFUND_LOCK
  const lockAgg = await tx.transactionLedgerEvent.aggregate({
    where: {
      stripeCreditPurchaseId,
      kind: TransactionKind.CREDIT_PURCHASE_REFUND_LOCK,
    },
    _sum: { deltaAdvertiserLockedCents: true },
  });
  const totalLocked = lockAgg._sum.deltaAdvertiserLockedCents ?? 0n;

  if (totalLocked <= 0n) return 0n;

  // Already consumed by refunds from locked
  const refundFromLockedAgg = await tx.transactionLedgerEvent.aggregate({
    where: {
      stripeCreditPurchaseId,
      kind: TransactionKind.CREDIT_PURCHASE_REFUND,
      deltaAdvertiserLockedCents: { lt: 0 },
    },
    _sum: { deltaAdvertiserLockedCents: true },
  });
  const alreadyRefundedFromLocked = -(
    refundFromLockedAgg._sum.deltaAdvertiserLockedCents ?? 0n
  );

  // Reversed by unlocks (failed refunds)
  const unlockAgg = await tx.transactionLedgerEvent.aggregate({
    where: {
      stripeCreditPurchaseId,
      kind: TransactionKind.CREDIT_PURCHASE_REFUND_UNLOCK,
    },
    _sum: { deltaAdvertiserLockedCents: true },
  });
  const totalUnlocked = -(unlockAgg._sum.deltaAdvertiserLockedCents ?? 0n);

  const pending = totalLocked - alreadyRefundedFromLocked - totalUnlocked;
  return pending > 0n ? pending : 0n;
}
