-- Address.timezone (IANA, e.g. "America/New_York"): added in three steps so the
-- NOT NULL constraint can be enforced on an already-populated table.
--   1. add nullable
--   2. backfill existing rows
--   3. set NOT NULL
-- All new rows are written with a real geo-derived timezone (via
-- getTimezoneForCoordinates at every address write site), so the constraint is
-- safe going forward.

-- 1. Add as nullable.
ALTER TABLE "app"."addresses" ADD COLUMN "timezone" TEXT;

-- 2. One-time legacy backfill of existing rows by country.
--    ⚠️ This is a one-time seed valid ONLY for the current single-timezone
--    footprint: the sole US market is Tampa (Eastern) and CZ is a single zone.
--    It is NOT the ongoing rule — new addresses derive their timezone from the
--    geocoded lat/lon. The moment a US business exists outside Eastern, this
--    heuristic would be wrong, which is why it only ever runs here, once.
UPDATE "app"."addresses" SET "timezone" = 'America/New_York' WHERE "country_code" = 'US' AND "timezone" IS NULL;
UPDATE "app"."addresses" SET "timezone" = 'Europe/Prague'    WHERE "country_code" = 'CZ' AND "timezone" IS NULL;

-- 3. Enforce NOT NULL now that every row is populated.
ALTER TABLE "app"."addresses" ALTER COLUMN "timezone" SET NOT NULL;

-- AlterTable
ALTER TABLE "app"."local_subaccounts" ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "menu_url" TEXT,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "reservation_url" TEXT,
ADD COLUMN     "website_url" TEXT;

-- CreateTable
CREATE TABLE "app"."opening_hours_periods" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_minute" INTEGER NOT NULL,
    "close_minute" INTEGER NOT NULL,

    CONSTRAINT "opening_hours_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opening_hours_periods_local_id_idx" ON "app"."opening_hours_periods"("local_id");

-- AddForeignKey
ALTER TABLE "app"."opening_hours_periods" ADD CONSTRAINT "opening_hours_periods_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "app"."local_subaccounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
