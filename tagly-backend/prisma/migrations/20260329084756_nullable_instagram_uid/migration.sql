-- AlterTable
ALTER TABLE "app"."pending_customers" ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "instagram_uid" DROP NOT NULL,
ALTER COLUMN "full_name" DROP NOT NULL,
ALTER COLUMN "wants_promo_emails" DROP NOT NULL,
ALTER COLUMN "agreed_to_terms_of_service_at" DROP NOT NULL,
ALTER COLUMN "agreed_to_privacy_policy_at" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL;
