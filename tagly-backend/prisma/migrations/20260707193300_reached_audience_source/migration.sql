-- Reached-audience source support (geo audience v4).
-- Hand-adjusted from the Prisma-generated diff: the enum change is a value
-- RENAME (Prisma emitted a full type recreation), and the totals column is a
-- RENAME (Prisma emitted DROP+ADD, which would lose existing values).

-- Rename the never-written enum value to its final name. No row has ever held
-- 'REACHED_AUDIENCE_24H' (only FOLLOWER_AUDIENCE is written today), so this is
-- a pure catalog rename with no data impact.
ALTER TYPE "app"."AudienceLocationSource" RENAME VALUE 'REACHED_AUDIENCE_24H' TO 'REACHED_AUDIENCE';

-- The total is now "the chosen source's breakdown sum", not follower-specific.
-- RENAME preserves the values on existing snapshots (they are follower totals,
-- which matches the backfilled audience_locations_source below).
ALTER TABLE "app"."instagram_snapshots" RENAME COLUMN "follower_location_total_value" TO "audience_locations_total_value";

-- Which audience-location source was chosen for this snapshot at capture time.
-- Nullable, no default: the worker states the source explicitly on every
-- insert, and NULL means the snapshot captured no audience locations at all
-- (e.g. <100 followers — IG suppresses the breakdowns).
ALTER TABLE "app"."instagram_snapshots" ADD COLUMN "audience_locations_source" "app"."AudienceLocationSource";

-- Backfill (hand-added): pre-existing snapshots are follower-based when they
-- hold audience rows, and NULL when they never captured a distribution.
UPDATE "app"."instagram_snapshots" s
SET "audience_locations_source" = 'FOLLOWER_AUDIENCE'
WHERE EXISTS (
  SELECT 1
  FROM "app"."instagram_audience_location" ial
  WHERE ial."snapshot_id" = s."id"
);
