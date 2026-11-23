import type { RequestHandler } from "express";
import { sql } from "kysely";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { db } from "../../../../db/kysely.js";
import {
  applyOffsetPagination,
  hasMoreFromPage,
} from "../../../../utils/core/db/applyOffsetPagination.js";
import { deriveWithdrawalDisplayState } from "../../../../utils/hydrators/billing/deriveWithdrawalDisplayState.js";
import type {
  CustomerTransaction,
  CustomerTransactionEarningSource,
  GetCustomerTransactionsBody,
} from "@tagly/models/v2/customerApp";

type PageRow = { src: string; id: number; createdAt: Date };

/**
 * `POST /v2/customers/transactions` — the customer's money history, newest first,
 * offset-paginated, with an optional `types` filter.
 *
 * The feed unions two sources the customer can actually see:
 *  - **Earnings** — ledger events for this customer of the three customer-crediting
 *    kinds (`SHARE_PAYMENT`, `REFERRAL_PAYOUT`, `ADJUSTMENT`). The `*_LOCK`/
 *    `*_UNLOCK` plumbing and every advertiser/platform-side kind are excluded.
 *  - **Withdrawals** — one item per `StripeWithdrawal` (NOT its underlying
 *    `WITHDRAWAL`/lock ledger rows), so failed/in-flight cash-outs show with a
 *    derived `WithdrawalDisplayState` via `deriveWithdrawalDisplayState`.
 *
 * Both are projected to `{ src, id, created_at }`, UNION ALL'd, ordered + paged in
 * SQL, then the page is hydrated (business name + share uid for share rewards;
 * status/amount for withdrawals). `types` selects which sources/kinds to include
 * (omitted/empty = all); a filter that excludes one source skips its query.
 */
export const getCustomerTransactions: RequestHandler = asyncHandler(async (req, res) => {
  const { offset, limit, types } = req.validatedBody as GetCustomerTransactionsBody;
  const customerId = req.user.id;

  // Resolve the filter → which ledger kinds + whether to include withdrawals.
  const all = !types || types.length === 0;
  const earningKinds: CustomerTransactionEarningSource[] = [];
  if (all || types!.includes("SHARE_PAYMENT")) earningKinds.push("SHARE_PAYMENT");
  if (all || types!.includes("REFERRAL_PAYOUT"))
    earningKinds.push("REFERRAL_PAYOUT");
  if (all || types!.includes("ADJUSTMENT")) earningKinds.push("ADJUSTMENT");
  const includeEarnings = earningKinds.length > 0;
  const includeWithdrawals = all || types!.includes("WITHDRAWAL");

  // Normalized projections for the union: a source discriminator + id + date.
  const earningsQ = db
    .selectFrom("app.transaction_ledger_events as le")
    .where("le.customer_id", "=", customerId)
    .where("le.kind", "in", earningKinds)
    .select((eb) => [
      sql<string>`'earning'`.as("src"),
      eb.ref("le.id").as("id"),
      eb.ref("le.created_at").as("createdAt"),
    ]);

  const withdrawalsQ = db
    .selectFrom("app.stripe_withdrawals as w")
    .where("w.customer_id", "=", customerId)
    .select((eb) => [
      sql<string>`'withdrawal'`.as("src"),
      eb.ref("w.id").as("id"),
      eb.ref("w.created_at").as("createdAt"),
    ]);

  const order = <T extends { orderBy: (...a: never[]) => T }>(q: T): T =>
    (q as any)
      .orderBy("createdAt", "desc")
      .orderBy("src", "desc")
      .orderBy("id", "desc");

  let pageRows: PageRow[] = [];
  if (includeEarnings && includeWithdrawals) {
    pageRows = (await applyOffsetPagination(order(earningsQ.unionAll(withdrawalsQ)), {
      offset,
      limit,
    }).execute()) as PageRow[];
  } else if (includeEarnings) {
    pageRows = (await applyOffsetPagination(order(earningsQ), {
      offset,
      limit,
    }).execute()) as PageRow[];
  } else if (includeWithdrawals) {
    pageRows = (await applyOffsetPagination(order(withdrawalsQ), {
      offset,
      limit,
    }).execute()) as PageRow[];
  }

  const hasMore = hasMoreFromPage(pageRows.length, limit);

  const earningIds = pageRows
    .filter((r) => r.src === "earning")
    .map((r) => r.id);
  const withdrawalIds = pageRows
    .filter((r) => r.src === "withdrawal")
    .map((r) => r.id);

  const [earningRows, withdrawalRows] = await Promise.all([
    earningIds.length
      ? prisma.transactionLedgerEvent.findMany({
          where: { id: { in: earningIds } },
          select: {
            id: true,
            kind: true,
            deltaCustomerCents: true,
            share: {
              select: {
                uid: true,
                local: {
                  select: {
                    name: true,
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
    withdrawalIds.length
      ? prisma.stripeWithdrawal.findMany({
          where: { id: { in: withdrawalIds } },
          select: {
            id: true,
            uid: true,
            amountCents: true,
            status: true,
            payoutStatus: true,
            payoutAttempts: true,
            nextPayoutRetryAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const earningById = new Map(earningRows.map((e) => [e.id, e]));
  const withdrawalById = new Map(withdrawalRows.map((w) => [w.id, w]));

  // Assemble in the union's (newest-first) order; drop any row we couldn't
  // resolve (defensive — shouldn't happen).
  const transactions = pageRows.flatMap((row): CustomerTransaction[] => {
    if (row.src === "earning") {
      const e = earningById.get(row.id);
      if (!e) return [];
      return [
        {
          type: "earning",
          key: `e:${e.id}`,
          source: e.kind as CustomerTransactionEarningSource,
          amountCents: Number(e.deltaCustomerCents),
          businessName: e.share?.local?.name ?? null,
          businessBanner: e.share?.local?.banner ?? null,
          shareUid: e.share?.uid ?? null,
          createdAt: row.createdAt.toISOString(),
        },
      ];
    }
    const w = withdrawalById.get(row.id);
    if (!w) return [];
    return [
      {
        type: "withdrawal",
        key: `w:${w.uid}`,
        amountCents: Number(w.amountCents),
        state: deriveWithdrawalDisplayState({
          status: w.status,
          payoutStatus: w.payoutStatus,
          payoutAttempts: w.payoutAttempts,
          nextPayoutRetryAt: w.nextPayoutRetryAt,
        }),
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
});
