import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import type { AnyNumber } from "../../helpers/types.js";
import { recordReversal } from "../../../withdrawals/withdrawalTransitions.js";

export async function reverseWithdrawalFromTransfer(
  tx: Prisma.TransactionClient,
  input: {
    customerId: number;
    stripeWithdrawalId: number;
    transferId: string;
    totalReversedCents: AnyNumber; // Stripe transfer.amount_reversed (total so far)
    meta?: Prisma.InputJsonObject;
  }
): Promise<{
  event: TransactionLedgerEvent | null;
  created: boolean;
}> {
  const { customerId, stripeWithdrawalId, transferId } = input;

  if (!customerId || customerId <= 0) {
    throw createCustomError(1881, "customerId required", 400);
  }
  if (!stripeWithdrawalId || stripeWithdrawalId <= 0) {
    throw createCustomError(1882, "stripeWithdrawalId required", 400);
  }
  if (!transferId || transferId.trim().length === 0) {
    throw createCustomError(1883, "transferId required", 400);
  }

  const totalReversed = asBigInt(input.totalReversedCents);
  if (totalReversed <= 0n) {
    // nothing meaningful reversed
    return { event: null, created: false };
  }

  // externalRef encodes the *total* reversed so far so we can support partials:
  // withdraw:<customerId>:<withdrawalId>:reversal:<totalReversed>
  const externalRef = `withdraw:${customerId}:${stripeWithdrawalId}:reversal:${totalReversed.toString()}`;

  // Idempotency on this exact "state" (this totalReversed value)
  const existingForExternalRef = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: {
        externalRef,
        kind: TransactionKind.WITHDRAWAL_REVERSAL,
      },
    },
  });

  if (existingForExternalRef) {
    return { event: existingForExternalRef, created: false };
  }

  // Load the withdrawal row to:
  // - validate status/currency/amount
  // - ensure we only touch PENDING withdrawals
  const withdrawal = await tx.stripeWithdrawal.findUnique({
    where: { id: stripeWithdrawalId },
    select: {
      id: true,
      customerId: true,
      amountCents: true,
      currency: true,
      status: true,
    },
  });

  if (!withdrawal) {
    // best-effort noop; nothing to map this reversal to
    return { event: null, created: false };
  }

  if (withdrawal.customerId !== customerId) {
    throw createCustomError(1884, "withdrawal/customer mismatch", 500);
  }

  // Only operate on PENDING withdrawals. COMPLETED are considered fully paid out.
  if (withdrawal.status !== "PENDING") {
    return { event: null, created: false };
  }

  if (totalReversed > withdrawal.amountCents) {
    throw createCustomError(
      1885,
      "reversal amount exceeds original withdrawal",
      409
    );
  }

  // How much have we already credited back for this withdrawal?
  const agg = await tx.transactionLedgerEvent.aggregate({
    where: {
      kind: TransactionKind.WITHDRAWAL_REVERSAL,
      stripeWithdrawalId: withdrawal.id,
      customerId: withdrawal.customerId,
    },
    _sum: {
      deltaCustomerCents: true,
    },
  });

  const alreadyCredited =
    agg._sum.deltaCustomerCents && agg._sum.deltaCustomerCents > 0n
      ? agg._sum.deltaCustomerCents
      : 0n;

  const deltaToCredit = totalReversed - alreadyCredited;
  if (deltaToCredit <= 0n) {
    // we're already caught up with this totalReversed
    return { event: null, created: false };
  }

  // Source-of-truth: currency comes from the StripeWithdrawal row we already
  // loaded above (the canonical record for this withdrawal).
  const currency = withdrawal.currency;

  let event: TransactionLedgerEvent;
  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.WITHDRAWAL_REVERSAL,
      customerId,
      currency,
      deltaCustomerCents: deltaToCredit,

      externalRef,
      meta: {
        ...(input.meta ?? {}),
        reason: "transfer_reversed",
        stripeTransferId: transferId,
        stripeWithdrawalId: withdrawal.id,
        totalReversedCents: totalReversed.toString(),
        alreadyCreditedCents: alreadyCredited.toString(),
        deltaCreditedCents: deltaToCredit.toString(),
      },

      enforceZeroSum: false,
      idempotentOnExternalRef: false, // handled manually above
      stripeWithdrawalId: withdrawal.id,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef,
            kind: TransactionKind.WITHDRAWAL_REVERSAL,
          },
        },
      });
      if (again) {
        return { event: again, created: false };
      }
    }
    throw err;
  }

  // Mark as REVERSED when fully reversed; otherwise keep PENDING. Row state goes
  // through the single transition owner, which also maintains reversedCents (the
  // ledger aggregation above stays the source of truth). `reversedCents` is the
  // sole reversal signal — no failureCode sentinel is written (W-6).
  const isFullyReversed = totalReversed === withdrawal.amountCents;

  await recordReversal(tx, {
    withdrawalId: withdrawal.id,
    totalReversedCents: totalReversed,
    fullyReversed: isFullyReversed,
  });

  return { event, created: true };
}
