/*
  Warnings:

  - You are about to drop the column `promo_emails_opt_in_at` on the `advertisers` table. All the data in the column will be lost.
  - You are about to drop the column `promo_emails_opt_in_at` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `cancel_token` on the `pending_customers` table. All the data in the column will be lost.
  - You are about to drop the column `event_id` on the `notification_queue` table. All the data in the column will be lost.
  - You are about to drop the `advertiser_push_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_push_tokens` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[registration_token]` on the table `pending_customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[target,recipient_id,event_slug,channel,dedupe_key]` on the table `notification_queue` will be added. If there are existing duplicate values, this will fail.

*/

-- AlterEnum
ALTER TYPE "app"."AccountType" ADD VALUE 'PENDING_CUSTOMER';

-- DropForeignKey
ALTER TABLE "app"."advertiser_push_tokens" DROP CONSTRAINT "advertiser_push_tokens_advertiser_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."customer_push_tokens" DROP CONSTRAINT "customer_push_tokens_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "jobs"."notification_queue" DROP CONSTRAINT "notification_queue_event_id_fkey";

-- DropIndex
DROP INDEX "app"."pending_customers_cancel_token_key";

-- DropIndex
DROP INDEX "jobs"."notification_queue_recipient_id_event_id_channel_idx";

-- DropIndex
DROP INDEX "jobs"."notification_queue_target_recipient_id_event_id_channel_ded_key";

-- AlterTable
ALTER TABLE "app"."advertisers" DROP COLUMN "promo_emails_opt_in_at",
ADD COLUMN     "wants_promo_emails" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "app"."customers" DROP COLUMN "promo_emails_opt_in_at",
ADD COLUMN     "wants_promo_emails" BOOLEAN NOT NULL DEFAULT true;

-- RenameColumn: preserve existing registration tokens in pending_customers
-- (Prisma generates DROP+ADD which would fail on non-empty tables)
ALTER TABLE "app"."pending_customers" RENAME COLUMN "cancel_token" TO "registration_token";

-- Clear in-flight jobs — event_slug is NOT NULL with no default, so the table must be empty
TRUNCATE TABLE "jobs"."notification_queue";

-- AlterTable
ALTER TABLE "jobs"."notification_queue" DROP COLUMN "event_id",
ADD COLUMN     "event_slug" TEXT NOT NULL;

-- CreateTable (must come before DROP TABLE so data migration can run)
CREATE TABLE "app"."push_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "device_id" TEXT,
    "timezone" TEXT,
    "disabled_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "customer_id" INTEGER,
    "advertiser_id" INTEGER,
    "pending_customer_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- DataMigration: copy existing push tokens into unified push_tokens table
-- Note: old tables used camelCase column names (deviceId, disabledAt) without @map
INSERT INTO "app"."push_tokens"
    ("token", "platform", "device_id", "timezone", "disabled_at", "last_seen_at", "customer_id", "created_at", "updated_at")
SELECT
    "token", "platform", "deviceId", "timezone", "disabledAt", "last_seen_at", "customer_id", "created_at", "updated_at"
FROM "app"."customer_push_tokens";

INSERT INTO "app"."push_tokens"
    ("token", "platform", "device_id", "timezone", "disabled_at", "last_seen_at", "advertiser_id", "created_at", "updated_at")
SELECT
    "token", "platform", "deviceId", "timezone", "disabledAt", "last_seen_at", "advertiser_id", "created_at", "updated_at"
FROM "app"."advertiser_push_tokens";

-- DropTable
DROP TABLE "app"."advertiser_push_tokens";

-- DropTable
DROP TABLE "app"."customer_push_tokens";

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "app"."push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_customer_id_idx" ON "app"."push_tokens"("customer_id");

-- CreateIndex
CREATE INDEX "push_tokens_advertiser_id_idx" ON "app"."push_tokens"("advertiser_id");

-- CreateIndex
CREATE INDEX "push_tokens_pending_customer_id_idx" ON "app"."push_tokens"("pending_customer_id");

-- CreateIndex
CREATE INDEX "push_tokens_disabled_at_idx" ON "app"."push_tokens"("disabled_at");

-- CreateIndex
CREATE UNIQUE INDEX "pending_customers_registration_token_key" ON "app"."pending_customers"("registration_token");

-- CreateIndex
CREATE INDEX "notification_queue_recipient_id_event_slug_channel_idx" ON "jobs"."notification_queue"("recipient_id", "event_slug", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_queue_target_recipient_id_event_slug_channel_d_key" ON "jobs"."notification_queue"("target", "recipient_id", "event_slug", "channel", "dedupe_key");

-- AddForeignKey
ALTER TABLE "app"."push_tokens" ADD CONSTRAINT "push_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."push_tokens" ADD CONSTRAINT "push_tokens_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."push_tokens" ADD CONSTRAINT "push_tokens_pending_customer_id_fkey" FOREIGN KEY ("pending_customer_id") REFERENCES "app"."pending_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
