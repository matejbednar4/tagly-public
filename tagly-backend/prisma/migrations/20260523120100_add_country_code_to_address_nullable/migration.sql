-- Adds nullable country_code (ISO alpha-2) to addresses. The follow-up
-- migration backfills existing rows with 'US' (production data is Tampa-only)
-- and tightens to NOT NULL.

ALTER TABLE "app"."addresses"
  ADD COLUMN "country_code" VARCHAR(2);
