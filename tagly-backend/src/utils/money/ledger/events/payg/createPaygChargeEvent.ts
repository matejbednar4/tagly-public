import type {
  Prisma,
  TransactionLedgerEvent,
} from "../../../../../generated/prisma/client.js";
import { TransactionKind } from "../../../../../generated/prisma/client.js";
import { createLedgerEvent } from "../../createLedgerEvent.js";
import { asBigInt } from "../../../../formatting/asBigInt.js";
import { createCustomError } from "../../../../core/errors/createCustomError.js";
import { AnyNumber } from "../../helpers/types.js";

/**
 * Books a PAYG_CHARGE: an advertiser's saved card charged off-session to fund a
 * specific share at settlement (card → available budget, share-scoped). Mirrors
 * createAdvertiserCreditPurchase, but with kind PAYG_CHARGE so card-funded shares
 * are distinguishable from prepaid credit purchases in the ledger — which is
 * exactly why the ledger-derived "credits purchased" figures
 * (`ledger/advertiserCreditPurchases.ts`) filter to CREDIT_PURCHASE only: a
 * PAYG charge is not a purchase, and PAYG "funded-ness" comes from the active
 * period / card on file, not from purchased credits.
 *
 * Idempotent on (externalRef, PAYG_CHARGE). `enforceZeroSum: false` — external
 * money entering from the card (the Stripe charge is the counterparty).
 */
export async function createPaygChargeEvent(
  tx: Prisma.TransactionClient,
  input: {
    advertiserId: number;
    deltaAdvertiserCents: AnyNumber; // must be > 0
    shareId: number;
    externalRef: string;
    stripeCreditPurchaseId: number; // link to the StripeCreditPurchase row
    meta?: Prisma.InputJsonObject;
  },
): Promise<{ event: TransactionLedgerEvent; created: boolean }> {
  const { advertiserId, shareId, externalRef, stripeCreditPurchaseId, meta } =
    input;

  const cents = asBigInt(input.deltaAdvertiserCents);

  if (!advertiserId || advertiserId <= 0) {
    throw createCustomError(1311, "advertiserId required", 400);
  }
  if (cents <= BigInt(0)) {
    throw createCustomError(1312, "amount must be > 0", 400);
  }
  if (!shareId || shareId <= 0) {
    throw createCustomError(1603, "shareId required", 400);
  }
  if (!externalRef || externalRef.trim().length === 0) {
    throw createCustomError(1314, "externalRef required for idempotency", 400);
  }

  // Idempotency on (externalRef, kind)
  const existing = await tx.transactionLedgerEvent.findUnique({
    where: {
      externalRef_kind: { externalRef, kind: TransactionKind.PAYG_CHARGE },
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
      kind: TransactionKind.PAYG_CHARGE,
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
          externalRef_kind: { externalRef, kind: TransactionKind.PAYG_CHARGE },
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
