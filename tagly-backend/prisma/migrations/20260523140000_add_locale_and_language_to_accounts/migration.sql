-- Adds `locale` (ISO alpha-2) and `language` (ISO 639-1) to the four account
-- tables. Existing rows backfill to 'US' / 'en' (accurate — every current
-- production user is a Tampa-based English speaker). Final state is NOT NULL
-- with no default; writers must always supply both.
--
-- Pattern mirrors the country_code migration from PR 2: add nullable →
-- backfill → set NOT NULL, in a single migration since the table sizes are
-- small and existing data has a known correct value.

-- Customer
ALTER TABLE "app"."customers" ADD COLUMN "locale" VARCHAR(2);
ALTER TABLE "app"."customers" ADD COLUMN "language" VARCHAR(5);
UPDATE "app"."customers"
  SET "locale" = 'US', "language" = 'en'
  WHERE "locale" IS NULL OR "language" IS NULL;
ALTER TABLE "app"."customers" ALTER COLUMN "locale" SET NOT NULL;
ALTER TABLE "app"."customers" ALTER COLUMN "language" SET NOT NULL;

-- PendingCustomer
ALTER TABLE "app"."pending_customers" ADD COLUMN "locale" VARCHAR(2);
ALTER TABLE "app"."pending_customers" ADD COLUMN "language" VARCHAR(5);
UPDATE "app"."pending_customers"
  SET "locale" = 'US', "language" = 'en'
  WHERE "locale" IS NULL OR "language" IS NULL;
ALTER TABLE "app"."pending_customers" ALTER COLUMN "locale" SET NOT NULL;
ALTER TABLE "app"."pending_customers" ALTER COLUMN "language" SET NOT NULL;

-- Advertiser
ALTER TABLE "app"."advertisers" ADD COLUMN "locale" VARCHAR(2);
ALTER TABLE "app"."advertisers" ADD COLUMN "language" VARCHAR(5);
UPDATE "app"."advertisers"
  SET "locale" = 'US', "language" = 'en'
  WHERE "locale" IS NULL OR "language" IS NULL;
ALTER TABLE "app"."advertisers" ALTER COLUMN "locale" SET NOT NULL;
ALTER TABLE "app"."advertisers" ALTER COLUMN "language" SET NOT NULL;

-- PendingAdvertiserAccount
ALTER TABLE "app"."pending_advertiser_accounts" ADD COLUMN "locale" VARCHAR(2);
ALTER TABLE "app"."pending_advertiser_accounts" ADD COLUMN "language" VARCHAR(5);
UPDATE "app"."pending_advertiser_accounts"
  SET "locale" = 'US', "language" = 'en'
  WHERE "locale" IS NULL OR "language" IS NULL;
ALTER TABLE "app"."pending_advertiser_accounts" ALTER COLUMN "locale" SET NOT NULL;
ALTER TABLE "app"."pending_advertiser_accounts" ALTER COLUMN "language" SET NOT NULL;
