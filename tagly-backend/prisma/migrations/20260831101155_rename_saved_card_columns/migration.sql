-- Rename the PAYG card columns to purpose-neutral names: the saved off-session
-- card (+ its MIT mandate consent) is now shared by pay-as-you-go AND the
-- monthly-budget top-up, with each feature's on/off state tracked by its own
-- period model.
--
-- HAND-CORRECTED from Prisma's generated DROP COLUMN + ADD COLUMN (which would
-- have destroyed every linked card id) to in-place renames. No data movement.
ALTER TABLE "app"."advertiser_sensitive_data" RENAME COLUMN "payg_payment_method_id" TO "saved_payment_method_id";
ALTER TABLE "app"."advertiser_sensitive_data" RENAME COLUMN "payg_charge_authorized_at" TO "off_session_charge_authorized_at";
