import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { AnyNumber } from "../../helpers/types.js";

export async function lockBalanceForWithdrawal(
  tx: Prisma.TransactionClient,
  input: {
    customerId: number;
    amountCents: AnyNumber; // must be > 0
    withdrawalUid: string; // unique per withdrawal, used for lock/unlock idempotency

    meta?: Prisma.InputJsonObject;

    stripeWithdrawalId: number;
  },
): Promise<{
  event: TransactionLedgerEvent;
  lockCents: bigint;
  created: boolean;
}> {
  const { customerId, withdrawalUid } = input;

  if (!customerId || customerId <= 0) {
    throw createCustomError(1611, "customerId required", 400);
  }
  if (!withdrawalUid || withdrawalUid.trim().length === 0) {
    throw createCustomError(1612, "withdrawalUid required", 400);
  }

  const amount = asBigInt(input.amountCents);
  if (amount <= 0n) {
    throw createCustomError(1613, "amount must be > 0", 400);
  }

  const externalRef = `withdraw:${customerId}:${withdrawalUid}:lock:v1`;

  // Source-of-truth: currency comes from the StripeWithdrawal row that the
  // caller already created.
  const withdrawal = await tx.stripeWithdrawal.findUnique({
    where: { id: input.stripeWithdrawalId },
    select: { currency: true },
  });
  if (!withdrawal) {
    throw createCustomError(1616, "stripe withdrawal not found", 404);
  }
  const currency = withdrawal.currency;

  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: {
      sensitiveData: {
        select: {
          balanceUsdCents: true,
        },
      },
    },
  });

  if (!customer?.sensitiveData) {
    throw createCustomError(1614, "customer sensitiveData missing", 500);
  }
  if (customer.sensitiveData.balanceUsdCents < amount) {
    throw createCustomError(1615, "insufficient funds", 409);
  }

  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: { externalRef, kind: TransactionKind.WITHDRAWAL_LOCK },
    },
  });
  if (existing) {
    return {
      event: existing,
      lockCents: existing.deltaCustomerLockedCents,
      created: false,
    };
  }

  try {
    const event = await createLedgerEvent(tx, {
      kind: TransactionKind.WITHDRAWAL_LOCK,
      customerId,
      currency,
      deltaCustomerCents: -amount,
      deltaCustomerLockedCents: amount,
      externalRef,
      meta: {
        ...(input.meta ?? {}),
        requestedWithdrawalCents: amount.toString(),
      },

      enforceZeroSum: true,
      idempotentOnExternalRef: false, // handled here
      stripeWithdrawalId: input.stripeWithdrawalId,
    });

    // Concurrency guard (TOCTOU): the pre-check above and the balance debit
    // inside createLedgerEvent are not atomic, so two withdrawals racing on the
    // same balance could both pass the pre-check and both debit, overdrawing to
    // a negative balance. The decrementing UPDATE serializes on the customer row
    // lock, so re-reading here (same tx, post-debit) yields the true balance; a
    // negative result means we lost the race — throw to roll back this event and
    // the caller's StripeWithdrawal row.
    const after = await tx.customer.findUnique({
      where: { id: customerId },
      select: { sensitiveData: { select: { balanceUsdCents: true } } },
    });
    if (!after?.sensitiveData || after.sensitiveData.balanceUsdCents < 0n) {
      throw createCustomError(1615, "insufficient funds", 409);
    }

    return { event, lockCents: amount, created: true };
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef,
            kind: TransactionKind.WITHDRAWAL_LOCK,
          },
        },
      });
      if (again) {
        return {
          event: again,
          lockCents: again.deltaCustomerLockedCents,
          created: false,
        };
      }
    }
    throw err;
  }
}
