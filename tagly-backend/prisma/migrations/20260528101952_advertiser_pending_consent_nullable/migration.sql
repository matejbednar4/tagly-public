-- AlterTable
ALTER TABLE "app"."pending_advertiser_accounts" ALTER COLUMN "promo_notifications_enabled" DROP NOT NULL,
ALTER COLUMN "agreed_to_terms_of_service_at" DROP NOT NULL,
ALTER COLUMN "agreed_to_privacy_policy_at" DROP NOT NULL;
