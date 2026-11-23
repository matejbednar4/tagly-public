-- Rename the pending-advertiser token column to match the customer table.
-- Pure RENAME (not drop + add) so existing pending rows keep their token.
ALTER TABLE "app"."pending_advertiser_accounts" RENAME COLUMN "cancel_token" TO "registration_token";

-- Add email_verified (mirrors PendingCustomer) — advertiser login moves to
-- OTP/OAuth, so the pending account now tracks email verification.
-- NOT NULL with default false; existing rows backfill to false.
ALTER TABLE "app"."pending_advertiser_accounts" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
