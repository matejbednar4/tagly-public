import { db } from "../../../db/kysely.js";
import { sql } from "kysely";
import { sharePaidSql } from "../../shares/shareAccess.js";
import type { CustomerStatisticsInput } from "@tagly/models/v2/customerApp";

/**
 * Lifetime sharing statistics for `GET /v2/customers/me/statistics`.
 *
 * Aggregates the customer's shares (count, paid count, distinct businesses) and
 * their SHARE_PAYMENT ledger deltas (total + average per paid share). Cents are
 * returned as `bigint`
 * (the Zod input shape); the schema coerces them to safe-integer numbers.
 */
export async function hydrateCustomerStatistics(
  customerId: number
): Promise<CustomerStatisticsInput> {
  // The three insights tables are each keyed by share_id (1:≤1), and a share is
  // only one post type, so these LEFT JOINs never multiply share rows — the
  // COUNT/SUM aggregates over shares stay correct while we also sum reach.
  const shareRow = await db
    .selectFrom("app.shares as s")
    .leftJoin("app.share_insights as si", "si.share_id", "s.id")
    .select(() => [
      sql<number>`CAST(COUNT(*) AS INT)`.as("total_shares"),
      sql<number>`CAST(COUNT(*) FILTER (WHERE ${sharePaidSql("s")}) AS INT)`.as(
        "paid_count"
      ),
      sql<number>`CAST(COUNT(DISTINCT s.local_id) AS INT)`.as("visited_places"),
      sql<string>`
        COALESCE(
          SUM(COALESCE(si.reach, 0)), 0
        )::text
      `.as("total_reach"),
    ])
    .where("s.customer_id", "=", customerId)
    .executeTakeFirst();

  const ledgerRow = await db
    .selectFrom("app.transaction_ledger_events as tle")
    .select([
      sql<string>`
        COALESCE(
          SUM(tle.delta_customer_cents) FILTER (
            WHERE tle.kind = 'SHARE_PAYMENT'
          ), 0
        )::text
      `.as("paid_sum_cents"),
    ])
    .where("tle.customer_id", "=", customerId)
    .executeTakeFirst();

  const totalShares = shareRow?.total_shares ?? 0;
  const paidCount = shareRow?.paid_count ?? 0;
  const visitedPlaces = shareRow?.visited_places ?? 0;

  // COALESCE(..., 0)::text always yields a valid integer string, so BigInt is safe.
  const totalRewardsCents = BigInt(ledgerRow?.paid_sum_cents ?? "0");
  const averageRewardPerShareCents =
    paidCount > 0 ? totalRewardsCents / BigInt(paidCount) : 0n;

  return {
    totalShares,
    totalRewardsCents,
    averageRewardPerShareCents,
    visitedPlaces,
    totalReachCount: Number(shareRow?.total_reach ?? "0"),
  };
}
