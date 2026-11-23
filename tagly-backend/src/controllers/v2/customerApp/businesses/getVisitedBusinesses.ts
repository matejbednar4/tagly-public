import type { RequestHandler } from "express";
import { sql } from "kysely";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { db } from "../../../../db/kysely.js";
import {
  applyOffsetPagination,
  hasMoreFromPage,
} from "../../../../utils/core/db/applyOffsetPagination.js";
import { businessVisibleSql } from "../../../../utils/businesses/businessAccessibility.js";
import hydrateBusinessPublicPreviews from "../../../../utils/hydrators/businesses/hydrateBusinessPublicPreviews.js";
import type { GetVisitedBusinessesBody } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/businesses/visited` — businesses the logged-in customer has
 * shared at ("visited"), most-recently-visited first, offset-paginated.
 *
 * A "visit" is a share at a business: `visitsCount` is the share count and
 * `totalEarnedCents` is the sum of the customer's `SHARE_PAYMENT` payouts there
 * (paid shares only — in-flight shares contribute 0). One grouped query does the
 * aggregation (count of distinct shares + summed payouts + latest share date),
 * ordered + paginated in SQL; the page's businesses are then hydrated into the
 * standard `BusinessPublicPreview` (so the client renders them with the shared
 * `BusinessPreview`) and the per-business stats are merged back on by uid.
 *
 * Historical by design: a business is listed whenever the customer has any share
 * carrying its `local_id` — but only while the business passes the canonical
 * customer-visibility gate (`businessVisibleSql`): a DELETED page disappears the
 * moment the owner removes it (its rows hard-purge later, nulling `local_id`),
 * and a BANNED page is hidden too. The gate joins into the aggregate so
 * pagination stays correct. The hydrator additionally skips any business whose
 * address has no readable coordinates.
 *
 * Visibility-only by design (an unfunded business must not vanish from the
 * customer's history) — the hydrated previews carry `isAccessible` so the
 * client can gate earn affordances on the row/detail it links to (E038).
 */
export const getVisitedBusinesses: RequestHandler = asyncHandler(
  async (req, res) => {
    const { offset, limit } =
      req.validatedBody as GetVisitedBusinessesBody;
    const customerId = req.user.id;

    // Per-business aggregate over the customer's shares. The left join to
    // SHARE_PAYMENT ledger events sums the payout; count(distinct) keeps the
    // visit count correct when a share has multiple payment events.
    // Deliberately moderation-agnostic (no shareAccess gate): a "visit" is that
    // the customer shared this business at all — the earnings come from the
    // ledger (a rejected share contributes $0 there), so no share-axis filter is
    // needed. Only `businessVisibleSql` gates which businesses may appear.
    const rows = await applyOffsetPagination(
      db
        .selectFrom("app.shares as s")
        .innerJoin("app.local_subaccounts as ls", "ls.id", "s.local_id")
        .leftJoin("app.transaction_ledger_events as le", (join) =>
          join
            .onRef("le.share_id", "=", "s.id")
            .on("le.kind", "=", "SHARE_PAYMENT"),
        )
        .where("s.customer_id", "=", customerId)
        .where("s.local_id", "is not", null)
        .where(businessVisibleSql)
        .groupBy("s.local_id")
        .select((eb) => [
          eb.ref("s.local_id").as("localId"),
          eb.fn.count("s.id").distinct().as("visitsCount"),
          eb.fn
            .coalesce(eb.fn.sum("le.delta_customer_cents"), sql<string>`0`)
            .as("totalEarnedCents"),
          eb.fn.max("s.created_at").as("lastVisitedAt"),
        ])
        .orderBy(sql`max(s.created_at)`, "desc")
        .orderBy("s.local_id", "desc"),
      { offset, limit },
    ).execute();

    const hasMore = hasMoreFromPage(rows.length, limit);

    const localIds = rows
      .map((r) => r.localId)
      .filter((id): id is number => id !== null);

    if (localIds.length === 0) {
      res.status(200).json({
        message: "Visited businesses fetched successfully",
        offset,
        hasMore,
        businesses: [],
      });
      return;
    }

    // The aggregate keys by id, the hydrated previews key by uid — bridge with an
    // id↔uid map so stats can be merged onto each preview.
    const idUidRows = await prisma.localSubaccount.findMany({
      where: { id: { in: localIds } },
      select: { id: true, uid: true },
    });
    const uidByLocalId = new Map(idUidRows.map((r) => [r.id, r.uid]));

    const statsByUid = new Map<
      string,
      { visitsCount: number; totalEarnedCents: number; lastVisitedAt: string }
    >();
    for (const r of rows) {
      const uid = r.localId !== null ? uidByLocalId.get(r.localId) : undefined;
      if (!uid) continue;
      statsByUid.set(uid, {
        visitsCount: Number(r.visitsCount),
        totalEarnedCents: Number(r.totalEarnedCents),
        lastVisitedAt: new Date(r.lastVisitedAt as Date).toISOString(),
      });
    }

    // Hydrate the standard business preview (reward estimate + address), in the
    // aggregate's most-recent-first order. Drops any business without resolvable
    // coordinates — its stats are dropped with it.
    const previews = await hydrateBusinessPublicPreviews({
      businessIds: localIds,
      customerId,
    });

    const businesses = previews.flatMap((business) => {
      const stats = statsByUid.get(business.uid);
      if (!stats) return [];
      return [{ business, ...stats }];
    });

    res.status(200).json({
      message: "Visited businesses fetched successfully",
      offset,
      hasMore,
      businesses,
    });
  },
);
