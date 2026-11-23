-- v2 auth schema prep:
--   1. Move the Instagram platform user id off `customers`/`pending_customers`
--      onto `customer_instagram_accounts` (its canonical, single home).
--   2. Add the federated-identity table (`oauth_identities`) for Google/Apple
--      sign-in, shared by customers + advertisers.
--   3. Make advertiser passwords nullable (v2 advertisers sign in with OTP /
--      Google / Apple; passwords are dropped entirely at the v1 cutover).
--
-- The IG-uid move is data-bearing, so it is hand-ordered: add the column
-- NULLABLE, backfill it from both owners, set NOT NULL, then drop the source
-- columns. The backfill MUST run before the source columns are dropped.

-- CreateEnum
CREATE TYPE "app"."OAuthProvider" AS ENUM ('GOOGLE', 'APPLE');
CREATE TYPE "app"."OAuthAccountKind" AS ENUM ('CUSTOMER', 'ADVERTISER');

-- 1) Add the new IG-uid column as NULLABLE so the backfill can populate it.
ALTER TABLE "app"."customer_instagram_accounts" ADD COLUMN "instagram_uid" TEXT;

-- 2) Backfill from each possible owner. NOTE: the original premise here — "every
--    IG account belongs to exactly one customer or pending_customer" — is FALSE.
--    `pendingCustomerId` is ON DELETE SET NULL, so completing a registration
--    without Instagram (v1 `completeRegistrationWithoutInstagram` deletes the
--    PendingCustomer without touching this table) leaves a row with BOTH owner
--    columns NULL. Production had exactly one such row (id=8, verified
--    2026-07-31), which the backfill skips and step 3's SET NOT NULL then
--    rejects — aborting the migration mid-deploy and leaving a P3009 that blocks
--    every subsequent deploy. Step 2b below removes those orphans first.
UPDATE "app"."customer_instagram_accounts" AS a
SET "instagram_uid" = c."instagram_uid"
FROM "app"."customers" AS c
WHERE a."customerId" = c."id" AND a."instagram_uid" IS NULL;

UPDATE "app"."customer_instagram_accounts" AS a
SET "instagram_uid" = p."instagram_uid"
FROM "app"."pending_customers" AS p
WHERE a."pendingCustomerId" = p."id" AND a."instagram_uid" IS NULL;

-- 2b) Drop ownerless orphans the backfill cannot populate. Such a row has no
--     customer and no pending_customer, so there is no uid to recover and no
--     account it could ever serve — it is unreachable data. `instagram_tokens`
--     and `instagram_snapshots` are ON DELETE CASCADE, so the orphan's token +
--     audience rows go with it (correct: that data is equally unreachable).
DELETE FROM "app"."customer_instagram_accounts"
WHERE "instagram_uid" IS NULL;

-- 3) Now that every row is populated, enforce NOT NULL + uniqueness.
ALTER TABLE "app"."customer_instagram_accounts" ALTER COLUMN "instagram_uid" SET NOT NULL;
CREATE UNIQUE INDEX "customer_instagram_accounts_instagram_uid_key" ON "app"."customer_instagram_accounts"("instagram_uid");

-- 4) Drop the old source columns (and their unique indexes).
DROP INDEX "app"."customers_instagram_uid_key";
DROP INDEX "app"."pending_customers_instagram_uid_key";
ALTER TABLE "app"."customers" DROP COLUMN "instagram_uid";
ALTER TABLE "app"."pending_customers" DROP COLUMN "instagram_uid";

-- CreateTable — federated sign-in identities (Google/Apple), shared across
-- customer + advertiser accounts. `kind` scopes uniqueness so one provider
-- identity can map to one customer AND one advertiser independently.
CREATE TABLE "app"."oauth_identities" (
    "id" SERIAL NOT NULL,
    "provider" "app"."OAuthProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" "app"."OAuthAccountKind" NOT NULL,
    "email" CITEXT,
    "customer_id" INTEGER,
    "pending_customer_id" INTEGER,
    "advertiser_id" INTEGER,
    "pending_advertiser_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_identities_customer_id_idx" ON "app"."oauth_identities"("customer_id");
CREATE INDEX "oauth_identities_pending_customer_id_idx" ON "app"."oauth_identities"("pending_customer_id");
CREATE INDEX "oauth_identities_advertiser_id_idx" ON "app"."oauth_identities"("advertiser_id");
CREATE INDEX "oauth_identities_pending_advertiser_id_idx" ON "app"."oauth_identities"("pending_advertiser_id");
CREATE UNIQUE INDEX "oauth_identities_provider_subject_kind_key" ON "app"."oauth_identities"("provider", "subject", "kind");

-- AddForeignKey
ALTER TABLE "app"."oauth_identities" ADD CONSTRAINT "oauth_identities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app"."oauth_identities" ADD CONSTRAINT "oauth_identities_pending_customer_id_fkey" FOREIGN KEY ("pending_customer_id") REFERENCES "app"."pending_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app"."oauth_identities" ADD CONSTRAINT "oauth_identities_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app"."oauth_identities" ADD CONSTRAINT "oauth_identities_pending_advertiser_id_fkey" FOREIGN KEY ("pending_advertiser_id") REFERENCES "app"."pending_advertiser_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Advertiser passwords → nullable (v2 advertisers are passwordless; the columns
-- are dropped entirely at the v1 cutover).
ALTER TABLE "app"."advertisers" ALTER COLUMN "password_id" DROP NOT NULL;
ALTER TABLE "app"."pending_advertiser_accounts" ALTER COLUMN "password_hash" DROP NOT NULL;
