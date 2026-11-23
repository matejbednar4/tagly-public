import { getLatestSnapshot } from "../../instagram/snapshots/getLatestSnapshot.js";
import { db } from "../../../db/kysely.js";
import { sql } from "kysely";

export type AudienceLocationPoint = { lat: number; lon: number };

/**
 * The customer's top `n` Instagram audience locations (highest follower count
 * first) from their latest snapshot, as lat/lon points. Used to anchor the
 * top-earning Discover shelf: geography is the dominant reward multiplier, so the
 * places the customer has the most followers are where their shares earn most.
 *
 * Returns `[]` when the customer has no snapshot yet, or a snapshot that
 * captured no audience locations (NULL source) — the top-earning shelf is then
 * hidden. Rows are filtered to the snapshot's stamped source
 * (`audienceLocationsSource`) — the same distribution the geo multiplier
 * prices; storage is either/or so the filter is a consistency guard, not a
 * disambiguator. Locations without a resolved point are skipped.
 */
export async function getTopAudienceLocations(
  customerId: number,
  n: number,
): Promise<AudienceLocationPoint[]> {
  const snapshot = await getLatestSnapshot(customerId, {
    id: true,
    audienceLocationsSource: true,
  });
  // No snapshot, or a snapshot that captured no audience locations (NULL source).
  if (!snapshot?.audienceLocationsSource) return [];

  const rows = await db
    .selectFrom("app.instagram_audience_location as l")
    .select([
      sql<number>`ST_Y(l.location::geometry)`.as("lat"),
      sql<number>`ST_X(l.location::geometry)`.as("lon"),
    ])
    .where("l.snapshot_id", "=", snapshot.id)
    .where("l.source", "=", snapshot.audienceLocationsSource)
    .where(sql<boolean>`l.location IS NOT NULL`)
    .orderBy("l.value", "desc")
    .limit(n)
    .execute();

  return rows
    .filter((r) => typeof r.lat === "number" && typeof r.lon === "number")
    .map((r) => ({ lat: r.lat, lon: r.lon }));
}
