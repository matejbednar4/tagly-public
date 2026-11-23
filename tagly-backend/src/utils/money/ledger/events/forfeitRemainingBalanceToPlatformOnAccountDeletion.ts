import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../generated/prisma/client.js";
import { createCustomError } from "../../../core/errors/createCustomError.js";
import { createLedgerEvent } from "../createLedgerEvent.js";

/**
 * Customer twin of `forfeitRemainingBudgetToPlatformOnAccountDeletion`: zero out
 * a deleting customer's remaining balance with an explicit `ADJUSTMENT` event,
 * so the forfeit is auditable instead of relying on the silent residual-balance
 * wipe when the sensitive-data row is deleted. Reads the balance fresh from the
 * passed transaction so the delta matches what the row holds at delete time.
 *
 * Only called with the customer's explicit forfeit consent (the App Review
 * 5.1.1(v) deletion path — no withdrawal, no Stripe Connect onboarding).
 */
export async function forfeitRemainingBalanceToPlatformOnAccountDeletion(
  tx: Prisma.TransactionClient,
  input: {
    customerId: number;
    currency: string;
    meta?: Prisma.InputJsonObject;
  },
): Promise<TransactionLedgerEvent> {
  const { customerId, currency, meta } = input;

  if (!customerId || customerId <= 0) {
    throw createCustomError(1617, "customerId required", 400);
  }

  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: {
      sensitiveData: {
        select: {
          balanceUsdCents: true,
          lockedBalanceUsdCents: true,
        },
      },
    },
  });

  if (!customer || !customer.sensitiveData) {
    throw createCustomError(1618, "customer sensitiveData missing", 500);
  }

  const balance = customer.sensitiveData.balanceUsdCents;
  const locked = customer.sensitiveData.lockedBalanceUsdCents;

  // A locked balance means a withdrawal is mid-flight — forfeiting around it
  // would strand its reconciliation. The controller blocks this upstream with
  // the same code; this is defense in depth for any future caller.
  if (locked > 0n) {
    throw createCustomError(1200, "funds are locked", 409);
  }

  // This helper is only meant to run when there is a positive balance.
  if (balance <= 0n) {
    throw createCustomError(1619, "no positive balance to forfeit", 400);
  }

  const externalRef = `customer:${customerId}:balance-forfeit:v1`;

  // Not zero-sum by design (mirrors the advertiser forfeit): the forfeited
  // balance is not platform "revenue" — it was already sitting in Stripe and
  // simply becomes unassigned again. retrieveAvailableStripeBalance captures it
  // correctly without any ledger entry on the platform side (unassignedCents
  // rises as customer balances drop).
  //
  // notify: false — the customer is deleted in this same transaction, so a
  // balance notification could never be delivered.
  const event = await createLedgerEvent(tx, {
    kind: TransactionKind.ADJUSTMENT,
    currency,
    customerId,

    // zero out the customer's balance
    deltaCustomerCents: -balance,

    externalRef,
    meta: {
      ...(meta ?? {}),
      reason: "customer-account-deletion-forfeit",
      forfeitedCents: balance.toString(),
    },
    enforceZeroSum: false,
    idempotentOnExternalRef: true,
    notify: false,
  });

  return event;
}
