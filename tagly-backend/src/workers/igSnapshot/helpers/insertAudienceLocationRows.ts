import { sql, type Transaction } from "kysely";
import type { DB } from "../../../db/types.js";
import type { AppAudiencelocationsource } from "../../../db/types.js";
import type { AudienceLocationRow } from "../../../utils/instagram/accountInsights/helpers/selectAndGeocodeAudienceLocations.js";

/**
 * Bulk-inserts one source's audience-location rows for a snapshot (PostGIS
 * point construction is why this is Kysely, not Prisma). Caller is expected to
 * have wiped the snapshot's previous rows first — the ON CONFLICT is only a
 * safety net for duplicate addresses within one batch.
 */
export async function insertAudienceLocationRows(
  trx: Transaction<DB>,
  {
    snapshotId,
    source,
    locations,
  }: {
    snapshotId: number;
    source: AppAudiencelocationsource;
    locations: AudienceLocationRow[];
  }
): Promise<void> {
  const rows = locations.filter(
    (r) =>
      r.address &&
      typeof r.value === "number" &&
      typeof r.lon === "number" &&
      typeof r.lat === "number"
  );
  if (rows.length === 0) return;

  await sql`
    INSERT INTO "app"."instagram_audience_location"
      ("address","location","value","source","snapshot_id","created_at","updated_at")
    VALUES ${sql.join(
      rows.map(
        (r) => sql`(
          ${r.address},
          ST_SetSRID(ST_MakePoint(${r.lon}, ${r.lat}), 4326)::geography,
          ${Math.trunc(r.value)},
          ${source}::"app"."AudienceLocationSource",
          ${snapshotId},
          NOW(),
          NOW()
        )`
      ),
      sql`,`
    )}
    ON CONFLICT ("snapshot_id","source","address")
    DO UPDATE SET
      "value" = EXCLUDED."value",
      "location" = EXCLUDED."location",
      "updated_at" = NOW()
  `.execute(trx);
}
