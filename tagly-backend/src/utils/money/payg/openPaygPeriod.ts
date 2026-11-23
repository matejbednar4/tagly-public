import prisma from "../../../prisma/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { createCustomError } from "../../core/errors/createCustomError.js";

/**
 * Opens a PAYG period for the advertiser.
 *
 * Invariant — a period may exist ONLY while a PAYG card is on file. The card
 * (`AdvertiserSensitiveData.savedPaymentMethodId`) is the source of truth read by
 * every charge/settlement path; a period just records that PAYG is active, not
 * which card. This is the single chokepoint every opener funnels through, so it
 * *enforces* that invariant: callers set the card in the SAME transaction before
 * opening, and this throws if the card is missing — no path can create a
 * card-less period. (The mirror direction is upheld by `removePaygPaymentMethod`,
 * the only card-clearer, which closes the period in the same transaction.)
 *
 * No card *validity* check — Stripe already validates the card during the
 * SetupIntent flow. If Stripe accepted it we open the period, so a previously-
 * failed card can be re-linked after going through Stripe again (e.g. a card
 * that had insufficient funds but has since been topped up).
 *
 * Idempotent and race-safe: the "at most one open period per advertiser"
 * invariant is enforced by a partial unique index (one row WHERE ended_at IS
 * NULL). `createMany({ skipDuplicates })` compiles to INSERT ... ON CONFLICT DO
 * NOTHING, so a concurrent double-open (the success-page reconcile call racing
 * the setup_intent.succeeded webhook) blocks on the loser, then no-ops — it
 * never duplicates the row, and never raises P2002 to abort the caller's
 * transaction. The follow-up read always returns the surviving open period.
 */
export async function openPaygPeriod(
  advertiserId: number,
  tx: Prisma.TransactionClient = prisma,
): Promise<{ id: number }> {
  // Enforce the invariant: never open a period without a card on file. The card
  // is set (same tx) by every opener before this call; guard against a future
  // caller that forgets. Fetched via the advertiser relation — the card column
  // lives on AdvertiserSensitiveData, whose FK is on the Advertiser side.
  const adv = await tx.advertiser.findUnique({
    where: { id: advertiserId },
    select: { sensitiveData: { select: { savedPaymentMethodId: true } } },
  });
  if (!adv?.sensitiveData?.savedPaymentMethodId) {
    throw createCustomError(
      1342,
      "cannot open a PAYG period without a card on file",
      400,
    );
  }

  await tx.paygPeriod.createMany({
    data: [{ advertiserId }],
    skipDuplicates: true,
  });

  return tx.paygPeriod.findFirstOrThrow({
    where: { advertiserId, endedAt: null },
    select: { id: true },
  });
}
