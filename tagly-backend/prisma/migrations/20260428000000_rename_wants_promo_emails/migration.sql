-- Rename wants_promo_emails → promo_notifications_enabled on all four recipient tables

ALTER TABLE "pending_customers" RENAME COLUMN "wants_promo_emails" TO "promo_notifications_enabled";
ALTER TABLE "customers" RENAME COLUMN "wants_promo_emails" TO "promo_notifications_enabled";
ALTER TABLE "pending_advertiser_accounts" RENAME COLUMN "wants_promo_emails" TO "promo_notifications_enabled";
ALTER TABLE "advertisers" RENAME COLUMN "wants_promo_emails" TO "promo_notifications_enabled";
