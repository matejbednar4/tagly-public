import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import type { AnyNumber } from "../../helpers/types.js";

export async function createWithdrawalFromLocked(
  tx: Prisma.TransactionClient,
  input: {
    customerId: number;
    amountCents: AnyNumber; // must be > 0
    transferId: string; // Stripe transfer id (externalRef)
    meta?: Prisma.InputJsonObject;
    stripeWithdrawalId: number; // link to StripeWithdrawal
  }
): Promise<{
  event: TransactionLedgerEvent;
  created: boolean;
}> {
  if (!input.customerId || input.customerId <= 0) {
    throw createCustomError(1761, "customerId required", 400);
  }
  if (!input.transferId || input.transferId.trim().length === 0) {
    throw createCustomError(1762, "transferId required", 400);
  }

  const amount = asBigInt(input.amountCents);
  if (amount <= 0n) {
    throw createCustomError(1763, "amount must be > 0", 400);
  }

  const externalRef = input.transferId;

  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: { externalRef, kind: TransactionKind.WITHDRAWAL },
    },
  });
  if (existing) {
    return { event: existing, created: false };
  }

  // Secondary idempotency guard by withdrawal linkage (helps reconciliation)
  const existingByWithdrawal = await tx.transactionLedgerEvent.findFirst({
    where: {
      kind: TransactionKind.WITHDRAWAL,
      stripeWithdrawalId: input.stripeWithdrawalId,
    },
  });
  if (existingByWithdrawal) {
    return { event: existingByWithdrawal, created: false };
  }

  const customer = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { sensitiveData: { select: { lockedBalanceUsdCents: true } } },
  });
  if (!customer?.sensitiveData) {
    throw createCustomError(1764, "customer sensitiveData missing", 500);
  }
  if (customer.sensitiveData.lockedBalanceUsdCents < amount) {
    // Should never happen — the withdrawal locked exactly this amount first, so a
    // shortfall means the lock accounting drifted. Alert (deduped per withdrawal).
    throw createCustomError(1765, "insufficient locked funds", {
      status: 409,
      notify: true,
      notifyKey: `withdrawal-insufficient-locked:${input.stripeWithdrawalId}`,
    });
  }

  // Source-of-truth: currency comes from the StripeWithdrawal row.
  const withdrawal = await tx.stripeWithdrawal.findUnique({
    where: { id: input.stripeWithdrawalId },
    select: { currency: true },
  });
  if (!withdrawal) {
    throw createCustomError(1766, "stripe withdrawal not found", 404);
  }

  let event: TransactionLedgerEvent;
  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.WITHDRAWAL,
      customerId: input.customerId,
      currency: withdrawal.currency,

      deltaCustomerLockedCents: -amount,

      externalRef,
      meta: {
        ...(input.meta ?? {}),
      },

      enforceZeroSum: false,
      idempotentOnExternalRef: false,
      stripeWithdrawalId: input.stripeWithdrawalId,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: { externalRef, kind: TransactionKind.WITHDRAWAL },
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
