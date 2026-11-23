import type { RequestHandler } from "express";
import { sql } from "kysely";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { db } from "../../../../db/kysely.js";
import {
  applyOffsetPagination,
  hasMoreFromPage,
} from "../../../../utils/core/db/applyOffsetPagination.js";
import type {
  AdvertiserTransaction,
  AdvertiserTransactionCreditSource,
  GetAdvertiserTransactionsBody,
} from "@tagly/models/v2/advertiserApp";

type PageRow = { src: string; id: number; createdAt: Date };

/**
 * `POST /v2/advertisers/transactions` — the advertiser's money history, newest
 * first, offset-paginated, with an optional `types` filter. Twin of the
 * customer `getCustomerTransactions` union pattern.
 *
 * The feed unions three sources the advertiser can actually see:
 *  - **Deposits** — one item per `StripeCreditPurchase` (prepaid
 *    `CREDIT_PURCHASE` top-up or off-session `PAYG_CHARGE`), carrying its own
 *    `CreditPurchaseStatus` so pending/failed card charges are visible — the
 *    same role the withdrawal rows play in the customer feed. The ledger's
 *    `CREDIT_PURCHASE`/`PAYG_CHARGE` events are therefore excluded here (the
 *    purchase row already represents that movement — no double rows).
 *  - **Spend** — `SHARE_PAYMENT` ledger events for this advertiser (the debit
 *    at share settlement), hydrated with the share uid + business name for
 *    deep-linking. Subsidized settles never stamp `advertiserId`, so they're
 *    excluded by the ownership filter itself.
 *  - **Credits** — the remaining advertiser-facing kinds
 *    (`CREDIT_PURCHASE_REFUND`, `PROMOTIONAL_CREDIT`, `ADJUSTMENT`,
 *    `REFERRAL_PAYOUT`), signed. The `SHARE_LOCK`/`SHARE_UNLOCK` and
 *    refund-lock plumbing is never surfaced (locked total lives on the balance
 *    card).
 *
 * All sources are projected to `{ src, id, created_at }`, UNION ALL'd, ordered
 * + paged in SQL, then the page is hydrated. Read-only — no ledger writes.
 */
export const getAdvertiserTransactions: RequestHandler = asyncHandler(
  async (req, res) => {
    const { offset, limit, types } =
      req.validatedBody as GetAdvertiserTransactionsBody;
    const advertiserId = req.user.id;

    // Resolve the filter → which sources / ledger kinds to include.
    const all = !types || types.length === 0;
    const includeDeposits = all || types!.includes("DEPOSIT");
    const includeSpend = all || types!.includes("SPEND");
    const creditKinds: AdvertiserTransactionCreditSource[] = [];
    if (all || types!.includes("CREDIT_PURCHASE_REFUND"))
      creditKinds.push("CREDIT_PURCHASE_REFUND");
    if (all || types!.includes("PROMOTIONAL_CREDIT"))
      creditKinds.push("PROMOTIONAL_CREDIT");
    if (all || types!.includes("ADJUSTMENT")) creditKinds.push("ADJUSTMENT");
    if (all || types!.includes("REFERRAL_PAYOUT"))
      creditKinds.push("REFERRAL_PAYOUT");

    // Which ledger kinds the union needs (spend + credits share the table).
    const ledgerKinds = [
      ...(includeSpend ? (["SHARE_PAYMENT"] as const) : []),
      ...creditKinds,
    ];

    // Normalized projections for the union: a source discriminator + id + date.
    const depositsQ = db
      .selectFrom("app.stripe_credit_purchases as cp")
      .where("cp.advertiser_id", "=", advertiserId)
      .select((eb) => [
        sql<string>`'deposit'`.as("src"),
        eb.ref("cp.id").as("id"),
        eb.ref("cp.created_at").as("createdAt"),
      ]);

    const ledgerQ = db
      .selectFrom("app.transaction_ledger_events as le")
      .where("le.advertiser_id", "=", advertiserId)
      .where("le.kind", "in", ledgerKinds)
      .select((eb) => [
        sql<string>`'ledger'`.as("src"),
        eb.ref("le.id").as("id"),
        eb.ref("le.created_at").as("createdAt"),
      ]);

    const order = <T extends { orderBy: (...a: never[]) => T }>(q: T): T =>
      (q as any)
        .orderBy("createdAt", "desc")
        .orderBy("src", "desc")
        .orderBy("id", "desc");

    const includeLedger = ledgerKinds.length > 0;
    let pageRows: PageRow[] = [];
    if (includeDeposits && includeLedger) {
      pageRows = (await applyOffsetPagination(
        order(depositsQ.unionAll(ledgerQ)),
        { offset, limit },
      ).execute()) as PageRow[];
    } else if (includeDeposits) {
      pageRows = (await applyOffsetPagination(order(depositsQ), {
        offset,
        limit,
      }).execute()) as PageRow[];
    } else if (includeLedger) {
      pageRows = (await applyOffsetPagination(order(ledgerQ), {
        offset,
        limit,
      }).execute()) as PageRow[];
    }

    const hasMore = hasMoreFromPage(pageRows.length, limit);

    const depositIds = pageRows
      .filter((r) => r.src === "deposit")
      .map((r) => r.id);
    const ledgerIds = pageRows
      .filter((r) => r.src === "ledger")
      .map((r) => r.id);

    const [depositRows, ledgerRows] = await Promise.all([
      depositIds.length
        ? prisma.stripeCreditPurchase.findMany({
            where: { id: { in: depositIds } },
            select: {
              id: true,
              uid: true,
              kind: true,
              amountCents: true,
              paygSurchargeCents: true,
              status: true,
            },
          })
        : Promise.resolve([]),
      ledgerIds.length
        ? prisma.transactionLedgerEvent.findMany({
            where: { id: { in: ledgerIds } },
            select: {
              id: true,
              kind: true,
              deltaAdvertiserCents: true,
              deltaAdvertiserLockedCents: true,
              share: {
                select: {
                  uid: true,
                  local: {
                    select: {
                      name: true,
                      // Row thumbnail (same shape the customer feed sends).
                      banner: {
                        select: {
                          uid: true,
                          key: true,
                          aspectRatio: true,
                          type: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const depositById = new Map(depositRows.map((d) => [d.id, d]));
    const ledgerById = new Map(ledgerRows.map((e) => [e.id, e]));

    // Assemble in the union's (newest-first) order; drop any row we couldn't
    // resolve (defensive — shouldn't happen).
    const transactions = pageRows.flatMap((row): AdvertiserTransaction[] => {
      if (row.src === "deposit") {
        const d = depositById.get(row.id);
        if (!d) return [];
        return [
          {
            type: "deposit",
            key: `d:${d.uid}`,
            kind: d.kind,
            amountCents: Number(d.amountCents),
            paygSurchargeCents:
              d.paygSurchargeCents == null ? null : Number(d.paygSurchargeCents),
            status: d.status,
            createdAt: row.createdAt.toISOString(),
          },
        ];
      }
      const e = ledgerById.get(row.id);
      if (!e) return [];
      if (e.kind === "SHARE_PAYMENT") {
        // Net advertiser debit at settlement (locked drain + remainder unlock)
        // is negative; surface the positive magnitude, client renders as −/out.
        const debit = -Number(
          e.deltaAdvertiserCents + e.deltaAdvertiserLockedCents,
        );
        return [
          {
            type: "spend",
            key: `s:${e.id}`,
            amountCents: debit,
            businessName: e.share?.local?.name ?? null,
            businessBanner: e.share?.local?.banner ?? null,
            shareUid: e.share?.uid ?? null,
            createdAt: row.createdAt.toISOString(),
          },
        ];
      }
      return [
        {
          type: "credit",
          key: `c:${e.id}`,
          source: e.kind as AdvertiserTransactionCreditSource,
          amountCents: Number(e.deltaAdvertiserCents),
          createdAt: row.createdAt.toISOString(),
        },
      ];
    });

    res.status(200).json({
      message: "Transactions fetched successfully",
      offset,
      hasMore,
      transactions,
    });
  },
);
