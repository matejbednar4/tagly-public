import type { Prisma } from "../../../../../generated/prisma/client.js";
import {
  CreditPurchaseStatus,
  TransactionKind,
} from "../../../../../generated/prisma/client.js";

/**
 * Re-derive a StripeCreditPurchase's REFUNDED / PARTIALLY_REFUNDED status from
 * the ledger — the sum of all CREDIT_PURCHASE_REFUND events booked for it
 * (regular refunds AND dispute clawbacks share the kind; only their
 * externalRefs differ) — and persist it. Shared by `handleRefundEvent` and
 * `handleDisputeEvent` so the status math cannot drift between the two paths.
 *
 * Leaves the status untouched when nothing has been refunded (defensive — both
 * callers invoke this right after booking a refund event).
 */
export async function recalcCreditPurchaseRefundStatus(
  tx: Prisma.TransactionClient,
  creditPurchase: {
    id: number;
    uid: string;
    amountCents: bigint;
    advertiserId: number;
    status: CreditPurchaseStatus;
  },
): Promise<CreditPurchaseStatus> {
  const agg = await tx.transactionLedgerEvent.aggregate({
    where: {
      advertiserId: creditPurchase.advertiserId,
      kind: TransactionKind.CREDIT_PURCHASE_REFUND,
      meta: {
        path: ["creditPurchaseUid"],
        equals: creditPurchase.uid,
      },
    },
    _sum: {
      deltaAdvertiserLockedCents: true,
    },
  });

  const totalRefundDelta = agg._sum.deltaAdvertiserLockedCents ?? 0n;
  // Refund deltas are negative → take absolute value
  const totalRefundedCents =
    totalRefundDelta < 0n ? -totalRefundDelta : totalRefundDelta;

  let newStatus = creditPurchase.status;
  if (totalRefundedCents >= creditPurchase.amountCents) {
    newStatus = CreditPurchaseStatus.REFUNDED;
  } else if (totalRefundedCents > 0n) {
    newStatus = CreditPurchaseStatus.PARTIALLY_REFUNDED;
  }

  await tx.stripeCreditPurchase.update({
    where: { id: creditPurchase.id },
    data: {
      status: newStatus,
      failureCode: null,
      failureMessage: null,
    },
  });

  return newStatus;
}
