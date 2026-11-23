import { Prisma, TransactionKind } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.js";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Lifetime advertiser credit purchases, derived from the ledger on read.
 *
 * There is deliberately NO stored accumulator for this (the old
 * `AdvertiserSensitiveData.totalCreditPurchasesUsdCents` column was dropped at
 * the v1 cutover): the ledger is the single money source of truth, and a
 * denormalized counter was a second source that could only drift from it —
 * exactly as total withdrawals are already derived (`getStatistics` sums
 * `kind: WITHDRAWAL`).
 *
 * THE ONE RULE both helpers share: filter to `kind = CREDIT_PURCHASE` ONLY.
 *  - NOT `PAYG_CHARGE` — a PAYG charge settles a share, it does not buy
 *    credits, and PAYG "funded-ness" comes from the open period / card on file
 *    (see `createPaygChargeEvent`).
 *  - NOT the refund / dispute-clawback / deletion-forfeit kinds — the figure is
 *    GROSS ("credits purchased"), matching the advertiser app's stat tile and
 *    the admin display; net belongs in a separate query if ever needed.
 * Keep every reader on these two functions so the filter can never drift
 * between call sites.
 *
 * Both are indexed reads (`@@index([advertiserId])` on the ledger).
 */

/** "Has this account EVER bought credits" — an EXISTS, no sum (hot-path safe). */
export async function hasAdvertiserEverPurchasedCredits(
  advertiserId: number,
  db: Db = prisma,
): Promise<boolean> {
  const row = await db.transactionLedgerEvent.findFirst({
    where: { advertiserId, kind: TransactionKind.CREDIT_PURCHASE },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Prisma `where` fragment for the same rule, for set-based queries over
 * `Advertiser` (e.g. "advertisers who NEVER purchased credits" →
 * `ledgerEvents: { none: CREDIT_PURCHASE_LEDGER_EVENT_WHERE }`).
 */
export const CREDIT_PURCHASE_LEDGER_EVENT_WHERE = {
  kind: TransactionKind.CREDIT_PURCHASE,
} as const satisfies Prisma.TransactionLedgerEventWhereInput;

/** Gross lifetime credits purchased, in USD cents. `0n` when none. */
export async function sumAdvertiserCreditPurchasesCents(
  advertiserId: number,
  db: Db = prisma,
): Promise<bigint> {
  const agg = await db.transactionLedgerEvent.aggregate({
    where: { advertiserId, kind: TransactionKind.CREDIT_PURCHASE },
    _sum: { deltaAdvertiserCents: true },
  });
  return agg._sum.deltaAdvertiserCents ?? 0n;
}

/**
 * Batch form of `sumAdvertiserCreditPurchasesCents` for list hydrators — one
 * `groupBy` instead of N aggregates. Advertisers with no purchases are absent
 * from the map; read with `?? 0n`.
 */
export async function sumAdvertiserCreditPurchasesCentsByAdvertiser(
  advertiserIds: number[],
  db: Db = prisma,
): Promise<Map<number, bigint>> {
  if (advertiserIds.length === 0) return new Map();
  const rows = await db.transactionLedgerEvent.groupBy({
    by: ["advertiserId"],
    where: {
      advertiserId: { in: advertiserIds },
      kind: TransactionKind.CREDIT_PURCHASE,
    },
    _sum: { deltaAdvertiserCents: true },
  });
  const out = new Map<number, bigint>();
  for (const r of rows) {
    if (r.advertiserId != null) {
      out.set(r.advertiserId, r._sum.deltaAdvertiserCents ?? 0n);
    }
  }
  return out;
}
