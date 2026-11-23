import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import { sharePaidSql } from "../../shares/shareAccess.js";
import { ADMIN_APPROVED_SHARE_STATUS } from "../../shares/shareAccess.js";
import type { AdvertiserStatisticsInput } from "@tagly/models/v2/advertiserApp";

/**
 * Lifetime advertiser statistics for `GET /v2/advertisers/me/statistics`.
 *
 * Aggregates the advertiser's APPROVED shares (PENDING/REJECTED are invisible to
 * the advertiser everywhere) — count, PAID count, settled spend (from the
 * `final_price` table), and Instagram reach (from `share_insights`) — plus their
 * REFERRAL_PAYOUT ledger deltas. Cents are returned as `bigint` (the Zod input
 * shape); the schema
 * coerces them to safe-integer numbers.
 *
 * The two LEFT JOINs are each keyed by `share_id` (1:≤1), so they never multiply
 * share rows — COUNT/SUM over shares stay correct while we also sum spend + reach.
 */
export async function hydrateAdvertiserStatistics(
  advertiserId: number
): Promise<AdvertiserStatisticsInput> {
  const shareRow = await db
    .selectFrom("app.shares as s")
    .leftJoin("app.final_price as fp", "fp.share_id", "s.id")
    .leftJoin("app.share_insights as si", "si.share_id", "s.id")
    .select(() => [
      sql<number>`CAST(COUNT(*) AS INT)`.as("total_shares"),
      sql<number>`CAST(COUNT(*) FILTER (WHERE ${sharePaidSql("s")}) AS INT)`.as(
        "paid_count"
      ),
      sql<string>`COALESCE(SUM(fp.final_price_cents), 0)::text`.as(
        "total_spend_cents"
      ),
      sql<string>`COALESCE(SUM(fp.final_price_cents) FILTER (WHERE ${sharePaidSql("s")}), 0)::text`.as(
        "paid_sum_cents"
      ),
      sql<number>`COALESCE(SUM(COALESCE(si.reach, 0)), 0)::int`.as(
        "total_reach"
      ),
    ])
    .where("s.advertiser_id", "=", advertiserId)
    .where("s.approval_status", "=", ADMIN_APPROVED_SHARE_STATUS)
    .executeTakeFirst();

  const referralRow = await db
    .selectFrom("app.transaction_ledger_events as tle")
    .select([
      sql<string>`
        COALESCE(
          SUM(tle.delta_advertiser_cents) FILTER (
            WHERE tle.kind = 'REFERRAL_PAYOUT'
          ), 0
        )::text
      `.as("referral_payouts_cents"),
    ])
    .where("tle.advertiser_id", "=", advertiserId)
    .executeTakeFirst();

  const totalShares = shareRow?.total_shares ?? 0;
  const paidCount = shareRow?.paid_count ?? 0;

  // COALESCE(..., 0)::text always yields a valid integer string, so BigInt is safe.
  const totalSpendCents = BigInt(shareRow?.total_spend_cents ?? "0");
  const paidSumCents = BigInt(shareRow?.paid_sum_cents ?? "0");
  const averagePricePerShareCents =
    paidCount > 0 ? paidSumCents / BigInt(paidCount) : 0n;

  return {
    totalShares,
    totalSpendCents,
    averagePricePerShareCents, // PAID only
    totalReach: shareRow?.total_reach ?? 0,
    totalReferralPayoutsCents: BigInt(
      referralRow?.referral_payouts_cents ?? "0"
    ),
  };
}
