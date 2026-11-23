-- DropForeignKey
ALTER TABLE "app"."advertiser_notification_event_preferences" DROP CONSTRAINT "advertiser_notification_event_preferences_advertiserId_fkey";

-- DropForeignKey
ALTER TABLE "app"."advertiser_notification_event_preferences" DROP CONSTRAINT "advertiser_notification_event_preferences_eventId_fkey";

-- DropForeignKey
ALTER TABLE "app"."advertisers" DROP CONSTRAINT "advertisers_password_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."customer_notification_event_preferences" DROP CONSTRAINT "customer_notification_event_preferences_customerId_fkey";

-- DropForeignKey
ALTER TABLE "app"."customer_notification_event_preferences" DROP CONSTRAINT "customer_notification_event_preferences_eventId_fkey";

-- DropIndex
DROP INDEX "app"."advertisers_password_id_key";

-- AlterTable
ALTER TABLE "app"."advertiser_sensitive_data" DROP COLUMN "total_credit_purchases_usd_cents";

-- AlterTable
ALTER TABLE "app"."advertisers" DROP COLUMN "notifications_backfilled_at",
DROP COLUMN "password_id";

-- AlterTable
ALTER TABLE "app"."customers" DROP COLUMN "notifications_backfilled_at";

-- AlterTable
ALTER TABLE "app"."pending_advertiser_accounts" DROP COLUMN "password_hash";

-- DropTable
DROP TABLE "app"."advertiser_notification_event_preferences";

-- DropTable
DROP TABLE "app"."advertiser_passwords";

-- DropTable
DROP TABLE "app"."customer_notification_event_preferences";

