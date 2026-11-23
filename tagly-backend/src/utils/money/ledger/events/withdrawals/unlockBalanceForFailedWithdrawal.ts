import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import type { AnyNumber } from "../../helpers/types.js";

export async function unlockBalanceForFailedWithdrawal(
  tx: Prisma.TransactionClient,
  input: {
    customerId: number;
    amountCents: AnyNumber; // must be > 0
    withdrawalUid: string; // same withdrawalUid used when locking
    reason?: string;
    lockLedgerEventId: number;
    stripeWithdrawalId: number;
  },
): Promise<{
  event: TransactionLedgerEvent;
  created: boolean;
}> {
  if (!input.customerId || input.customerId <= 0) {
    throw createCustomError(1751, "customerId required", 400);
  }
  if (!input.withdrawalUid || input.withdrawalUid.trim().length === 0) {
    throw createCustomError(1752, "withdrawalUid required", 400);
  }

  const amount = asBigInt(input.amountCents);
  if (amount <= 0n) {
    throw createCustomError(1753, "amount must be > 0", 400);
  }

  const externalRef = `withdraw:${input.customerId}:${input.withdrawalUid}:unlock:v1`;

  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: {
        externalRef,
        kind: TransactionKind.WITHDRAWAL_UNLOCK,
      },
    },
  });
  if (existing) {
    return { event: existing, created: false };
  }

  const c = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { sensitiveData: { select: { lockedBalanceUsdCents: true } } },
  });
  if (!c?.sensitiveData) {
    throw createCustomError(1754, "customer sensitiveData missing", 500);
  }
  if (c.sensitiveData.lockedBalanceUsdCents < amount) {
    throw createCustomError(1755, "insufficient locked funds", 409);
  }

  // Source-of-truth: currency comes from the StripeWithdrawal row.
  const withdrawal = await tx.stripeWithdrawal.findUnique({
    where: { id: input.stripeWithdrawalId },
    select: { currency: true },
  });
  if (!withdrawal) {
    throw createCustomError(1756, "stripe withdrawal not found", 404);
  }

  let event: TransactionLedgerEvent;
  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.WITHDRAWAL_UNLOCK,
      customerId: input.customerId,
      currency: withdrawal.currency,

      deltaCustomerCents: amount,
      deltaCustomerLockedCents: -amount,

      externalRef,
      meta: {
        reason: input.reason ?? "withdrawal_unlock",
        ...(input.lockLedgerEventId
          ? { lockLedgerEventId: input.lockLedgerEventId }
          : {}),
      },

      enforceZeroSum: true,
      idempotentOnExternalRef: false,
      stripeWithdrawalId: input.stripeWithdrawalId,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef,
            kind: TransactionKind.WITHDRAWAL_UNLOCK,
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
