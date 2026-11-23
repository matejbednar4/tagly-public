import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../generated/prisma/client.js";
import { createCustomError } from "../../../core/errors/createCustomError.js";
import { asBigInt } from "../../../formatting/asBigInt.js";
import { createLedgerEvent } from "../createLedgerEvent.js";
import type { AnyNumber } from "../helpers/types.js";

/**
 * Creates a PROMOTIONAL_CREDIT ledger event: credits an advertiser's
 * available budget and debits platform revenue by the same amount (zero-sum).
 *
 * Idempotent on (externalRef, PROMOTIONAL_CREDIT).
 * Catches P2002 for race conditions on the unique constraint.
 */
export async function createPromotionalCreditEvent(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId: number;
    amountCents: AnyNumber;
    currency: string;
    externalRef: string;
    meta?: Prisma.InputJsonObject;
  }
): Promise<{ event: TransactionLedgerEvent; created: boolean }> {
  const { advertiserId, currency, externalRef, meta } = input;

  const amount = asBigInt(input.amountCents);

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1901, "advertiserId required", 400);
  }
  if (amount <= 0n) {
    throw createCustomError(1902, "amount must be > 0", 400);
  }
  if (!externalRef || externalRef.trim().length === 0) {
    throw createCustomError(1903, "externalRef required for idempotency", 400);
  }

  // idempotency on (externalRef, kind)
  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: {
        externalRef,
        kind: TransactionKind.PROMOTIONAL_CREDIT,
      },
    },
  });
  if (existing) {
    return { event: existing, created: false };
  }

  let event: TransactionLedgerEvent;

  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.PROMOTIONAL_CREDIT,
      advertiserId,
      currency,
      deltaAdvertiserCents: amount,
      deltaPlatformCents: -amount,
      externalRef,
      meta,
      enforceZeroSum: true,
      idempotentOnExternalRef: false, // handled manually above
      notify: false,
    });
  } catch (err: any) {
    // race on unique(externalRef, kind)
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef,
            kind: TransactionKind.PROMOTIONAL_CREDIT,
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
