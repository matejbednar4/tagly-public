import type { RequestHandler } from "express";
import { sql } from "kysely";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import type { GetMySharesBody } from "@tagly/models/v2/customerApp";
import { db } from "../../../../db/kysely.js";
import {
  applyOffsetPagination,
  hasMoreFromPage,
} from "../../../../utils/core/db/applyOffsetPagination.js";
import {
  shareDeadSql,
  sharePaidSql,
} from "../../../../utils/shares/shareAccess.js";
import hydrateCustomerSharePreviews from "../../../../utils/hydrators/shares/hydrateCustomerSharePreviews.js";

/**
 * `POST /v2/customers/shares` — the logged-in customer's own shares, offset-
 * paginated (newest first by default). Filtered to `customer_id = req.user.id`
 * (ownership). Selects the page's ids here (sort + pagination), then hands them
 * to the hydrator. Cents ride the wire as Zod-input bigints (coerced by the
 * response schema), so the JSON isn't annotated with the output type.
 *
 * The `highest_reward` / `lowest_reward` sorts are reward-tiered, not a flat sort
 * on the estimate: PAID shares first by their ACTUAL payout (summed SHARE_PAYMENT
 * ledger deltas), then in-flight shares by their ESTIMATE, then failed/rejected
 * shares last (no reward, newest-first). See the sort block for the tiering.
 */
export const getShares: RequestHandler = asyncHandler(async (req, res) => {
  const { offset, limit, sortBy } = req.validatedBody as GetMySharesBody;
  const customerId = req.user.id;

  const base = db
    .selectFrom("app.shares as s")
    .select(["s.id"])
    .where("s.customer_id", "=", customerId);

  // Default + simple sorts. Reward sorts (below) override this.
  let sorted = base.orderBy("s.created_at", "desc").orderBy("s.id", "desc"); // newest
  if (sortBy === "oldest") {
    sorted = base.orderBy("s.created_at", "asc").orderBy("s.id", "asc");
  } else if (sortBy === "highest_reward" || sortBy === "lowest_reward") {
    // A naive sort by `estimated_reward_cents` is wrong: a PAID share's real reward
    // is its summed SHARE_PAYMENT ledger deltas (not the estimate), and failed /
    // rejected shares never earn anything, so ranking them by a phantom estimate is
    // meaningless. So reward sorts group into three tiers — PAID first (by ACTUAL
    // payout), then in-flight shares (by their ESTIMATE), then failed/rejected last
    // (no reward → newest-first). "Failed" = the canonical dead-share predicate:
    // UNPAYABLE, intake-rejected, or a VALID report.
    const failed = shareDeadSql("s");
    // 0 = paid, 1 = in-flight, 2 = failed — the primary key, so failures always sit
    // last regardless of any reward value.
    const tier = sql`CASE WHEN ${sharePaidSql("s")} THEN 0 WHEN ${failed} THEN 2 ELSE 1 END`;
    // The value each tier sorts by: actual payout for paid, estimate for in-flight,
    // NULL for failed (so the created_at tiebreak — not a phantom reward — orders them).
    const reward = sql`CASE
      WHEN ${sharePaidSql("s")} THEN COALESCE((
        SELECT SUM(e.delta_customer_cents) FROM app.transaction_ledger_events e
        WHERE e.share_id = s.id AND e.kind = 'SHARE_PAYMENT'
      ), 0)
      WHEN ${failed} THEN NULL
      ELSE s.estimated_reward_cents
    END`;
    sorted = base
      .orderBy(tier, "asc")
      .orderBy(reward, sortBy === "highest_reward" ? "desc" : "asc")
      .orderBy("s.created_at", "desc")
      .orderBy("s.id", "desc");
  }

  const idRows = await applyOffsetPagination(sorted, {
    offset,
    limit,
  }).execute();
  const hasMore = hasMoreFromPage(idRows.length, limit);

  const shares =
    idRows.length === 0
      ? []
      : await hydrateCustomerSharePreviews({
          shareIds: idRows.map((r) => r.id),
        });

  res
    .status(200)
    .json({ message: "Shares fetched successfully", offset, hasMore, shares });
});
