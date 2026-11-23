import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { AnyNumber } from "../../helpers/types.js";

/**
 * Lock budget for a credit-purchase refund (available → locked).
 * Called by the admin refund flow before issuing the Stripe refund,
 * and internally by refundAdvertiserCreditPurchase to ensure a
 * uniform lock → refund flow.
 */
export async function lockBudgetForCreditPurchaseRefund(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId: number;
    lockCents: AnyNumber;
    stripeCreditPurchaseId: number;
    externalRef: string;
    meta?: Prisma.InputJsonObject;
    requireSufficientAvailable?: boolean; // default true; false for webhook flows where refund already happened
  },
): Promise<{ event: TransactionLedgerEvent; created: boolean }> {
  const { advertiserId, stripeCreditPurchaseId, externalRef, meta } = input;
  const requireSufficient = input.requireSufficientAvailable ?? true;
  const lockAmount = asBigInt(input.lockCents);

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1701, "advertiserId required", 400);
  }
  if (lockAmount <= 0n) {
    throw createCustomError(1702, "lock amount must be > 0", 400);
  }

  if (requireSufficient) {
    const adv = await tx.advertiser.findUnique({
      where: { id: advertiserId },
      select: { sensitiveData: { select: { availableBudgetUsdCents: true } } },
    });

    if (!adv?.sensitiveData) {
      throw createCustomError(1703, "advertiser sensitiveData missing", 500);
    }

    if (adv.sensitiveData.availableBudgetUsdCents < lockAmount) {
      throw createCustomError(
        1704,
        "insufficient available budget to lock",
        400,
      );
    }
  }

  // Idempotency check
  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: {
        externalRef,
        kind: TransactionKind.CREDIT_PURCHASE_REFUND_LOCK,
      },
    },
  });
  if (existing) {
    return { event: existing, created: false };
  }

  // Source-of-truth: currency comes from the StripeCreditPurchase row.
  const creditPurchase = await tx.stripeCreditPurchase.findUnique({
    where: { id: stripeCreditPurchaseId },
    select: { currency: true },
  });
  if (!creditPurchase) {
    throw createCustomError(1705, "stripe credit purchase not found", 404);
  }

  let event: TransactionLedgerEvent;
  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.CREDIT_PURCHASE_REFUND_LOCK,
      currency: creditPurchase.currency,
      advertiserId,
      deltaAdvertiserCents: -lockAmount,
      deltaAdvertiserLockedCents: lockAmount,
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
            kind: TransactionKind.CREDIT_PURCHASE_REFUND_LOCK,
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
