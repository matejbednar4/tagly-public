import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../generated/prisma/client.js";
import { createCustomError } from "../../../core/errors/createCustomError.js";
import { createLedgerEvent } from "../createLedgerEvent.js";

export async function forfeitRemainingBudgetToPlatformOnAccountDeletion(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId: number;
    currency: string;
    meta?: Prisma.InputJsonObject;
  },
): Promise<TransactionLedgerEvent> {
  const { advertiserId, currency, meta } = input;

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1610, "advertiserId required", 400);
  }

  const advertiser = await tx.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      sensitiveData: {
        select: {
          availableBudgetUsdCents: true,
          lockedBudgetUsdCents: true,
        },
      },
    },
  });

  if (!advertiser || !advertiser.sensitiveData) {
    throw createCustomError(1611, "advertiser sensitiveData missing", 500);
  }

  const available = advertiser.sensitiveData.availableBudgetUsdCents;
  const locked = advertiser.sensitiveData.lockedBudgetUsdCents;

  const total = available + locked;

  // This helper is only meant to run when there is a positive net budget.
  if (total <= 0n) {
    throw createCustomError(1612, "no positive budget to forfeit", 400);
  }

  const externalRef = `advertiser:${advertiserId}:budget-forfeit:v1`;

  // Not zero-sum by design: the forfeited budget is not platform "revenue" —
  // it was already sitting in Stripe and simply becomes unassigned again.
  // retrieveAvailableStripeBalance captures it correctly without any ledger
  // entry on the platform side (unassignedCents rises as advertiser balances drop).
  const event = await createLedgerEvent(tx, {
    kind: TransactionKind.ADJUSTMENT,
    currency,
    advertiserId,

    // zero out both advertiser budgets
    deltaAdvertiserCents: -available,
    deltaAdvertiserLockedCents: -locked,

    externalRef,
    meta: {
      ...(meta ?? {}),
      reason: "advertiser-account-deletion-forfeit",
      forfeitedCents: total.toString(),
    },
    enforceZeroSum: false,
    idempotentOnExternalRef: true,
    notify: false,
  });

  return event;
}
