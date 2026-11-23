-- CreateEnum
CREATE TYPE "app"."WithdrawalPayoutStatus" AS ENUM ('NONE', 'IN_FLIGHT', 'PAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "app"."WithdrawalPurpose" AS ENUM ('CUSTOMER_WITHDRAWAL', 'ACCOUNT_DELETION_SWEEP');

-- AlterTable
ALTER TABLE "app"."stripe_withdrawals" ADD COLUMN     "next_payout_retry_at" TIMESTAMPTZ(3),
ADD COLUMN     "payout_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payout_status" "app"."WithdrawalPayoutStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "purpose" "app"."WithdrawalPurpose" NOT NULL DEFAULT 'CUSTOMER_WITHDRAWAL',
ADD COLUMN     "reversed_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "settled_at" TIMESTAMPTZ(3),
ADD COLUMN     "stripe_account_id" TEXT;

-- CreateIndex
CREATE INDEX "stripe_withdrawals_status_payout_status_idx" ON "app"."stripe_withdrawals"("status", "payout_status");
