import type { RequestHandler } from "express";
import { sql } from "kysely";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type { GetAdvertiserSharesBody } from "@tagly/models/v2/advertiserApp";
import { db } from "../../../../db/kysely.js";
import {
  applyOffsetPagination,
  hasMoreFromPage,
} from "../../../../utils/core/db/applyOffsetPagination.js";
import {
  ADMIN_APPROVED_SHARE_STATUS,
  shareDeadSql,
  sharePaidSql,
} from "../../../../utils/shares/shareAccess.js";
import hydrateAdvertiserSharePreviews from "../../../../utils/hydrators/shares/hydrateAdvertiserSharePreviews.js";

/**
 * `POST /v2/advertisers/shares` — the logged-in advertiser's own shares (across
 * all their businesses), offset-paginated (newest first by default). Filtered
 * to `advertiser_id = req.user.id` AND `approval_status = 'APPROVED'` — the
 * advertiser never sees PENDING/REJECTED shares. Selects the page's ids here
 * (sort + pagination), then hands them to the hydrator. Cents ride the wire as
 * Zod-input bigints (coerced by the response schema).
 *
 * The `highest_price` / `lowest_price` sorts are price-tiered, not a flat sort on
 * the estimate: a PAID share's real cost is its settled `final_price`, in-flight
 * shares rank by their ESTIMATE, and failed shares (UNPAYABLE or a VALID
 * report) never cost anything, so they sort last (newest-first). Mirrors the
 * customer reward-sort tiering.
 */
export const getShares: RequestHandler = asyncHandler(async (req, res) => {
  const { offset, limit, sortBy } = req.validatedBody as GetAdvertiserSharesBody;
  const advertiserId = req.user.id;

  const base = db
    .selectFrom("app.shares as s")
    .select(["s.id"])
    .where("s.advertiser_id", "=", advertiserId)
    .where("s.approval_status", "=", ADMIN_APPROVED_SHARE_STATUS);

  // Default + simple sorts. Price sorts (below) override this.
  let sorted = base.orderBy("s.created_at", "desc").orderBy("s.id", "desc"); // newest
  if (sortBy === "oldest") {
    sorted = base.orderBy("s.created_at", "asc").orderBy("s.id", "asc");
  } else if (sortBy === "highest_price" || sortBy === "lowest_price") {
    // "Failed" = the non-paying terminal states (the canonical dead-share
    // predicate). Intake rejection is already filtered out by the WHERE above,
    // so in practice this resolves to UNPAYABLE or a VALID report — but reusing
    // `shareDeadSql` keeps the "dead" definition in one place.
    const failed = shareDeadSql("s");
    // 0 = paid, 1 = in-flight, 2 = failed — the primary key, so failures always
    // sit last regardless of any price value.
    const tier = sql`CASE WHEN ${sharePaidSql("s")} THEN 0 WHEN ${failed} THEN 2 ELSE 1 END`;
    // The value each tier sorts by: settled final price for paid, estimate for
    // in-flight, NULL for failed (so the created_at tiebreak orders them).
    const price = sql`CASE
      WHEN ${sharePaidSql("s")} THEN COALESCE((
        SELECT fp.final_price_cents FROM app.final_price fp
        WHERE fp.share_id = s.id
      ), 0)
      WHEN ${failed} THEN NULL
      ELSE s.estimated_price_cents
    END`;
    sorted = base
      .orderBy(tier, "asc")
      .orderBy(price, sortBy === "highest_price" ? "desc" : "asc")
      .orderBy("s.created_at", "desc")
      .orderBy("s.id", "desc");
  }

  const idRows = await applyOffsetPagination(sorted, { offset, limit }).execute();
  const hasMore = hasMoreFromPage(idRows.length, limit);

  const shares =
    idRows.length === 0
      ? []
      : await hydrateAdvertiserSharePreviews({
          shareIds: idRows.map((r) => r.id),
        });

  res
    .status(200)
    .json({ message: "Shares fetched successfully", offset, hasMore, shares });
});
