-- Backfills country_code for all pre-existing addresses with 'US' (production
-- data is Tampa-only). Then tightens the column to NOT NULL.
--
-- Runbook note: if a non-US staging snapshot is restored, those addresses also
-- get stamped 'US' here — that's a known tradeoff for keeping the prod-safe
-- backfill simple. Re-geocode such staging data after restore if needed.

UPDATE "app"."addresses"
  SET "country_code" = 'US'
  WHERE "country_code" IS NULL;

ALTER TABLE "app"."addresses"
  ALTER COLUMN "country_code" SET NOT NULL;
