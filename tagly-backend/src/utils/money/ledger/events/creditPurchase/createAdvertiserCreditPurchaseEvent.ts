import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { AnyNumber } from "../../helpers/types.js";

export async function createAdvertiserCreditPurchase(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId: number;
    deltaAdvertiserCents: AnyNumber; // must be > 0
    externalRef: string; // e.g. Stripe PI id
    meta?: Prisma.InputJsonObject;
    stripeCreditPurchaseId: number; // link to StripeCreditPurchase
    shareId?: number; // optional — links the purchase to a share (e.g. PAYG convert)
  },
): Promise<{ event: TransactionLedgerEvent; created: boolean }> {
  const { advertiserId, externalRef, meta, stripeCreditPurchaseId, shareId } =
    input;

  const cents = asBigInt(input.deltaAdvertiserCents);

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1311, "advertiserId required", 400);
  }
  if (cents <= BigInt(0)) {
    throw createCustomError(1312, "amount must be > 0", 400);
  }
  if (!externalRef || externalRef.trim().length === 0) {
    throw createCustomError(1314, "externalRef required for idempotency", 400);
  }

  // Idempotency on (externalRef, kind)
  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: { externalRef, kind: TransactionKind.CREDIT_PURCHASE },
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
    throw createCustomError(1315, "stripe credit purchase not found", 404);
  }

  let event: TransactionLedgerEvent;
  try {
    event = await createLedgerEvent(tx, {
      kind: TransactionKind.CREDIT_PURCHASE,
      advertiserId,
      currency: creditPurchase.currency,
      deltaAdvertiserCents: cents,
      shareId,
      externalRef,
      meta,
      enforceZeroSum: false,
      stripeCreditPurchaseId,
      idempotentOnExternalRef: false, // idempotency handled here
    });
  } catch (err: any) {
    // Handle race with the unique constraint
    if (err?.code === "P2002") {
      const again = await tx.transactionLedgerEvent.findUnique({
        where: {
          externalRef_kind: {
            externalRef,
            kind: TransactionKind.CREDIT_PURCHASE,
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
