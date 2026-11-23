-- CreateEnum
CREATE TYPE "app"."ShareApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
-- Add `approval_status` with DEFAULT 'APPROVED' so every PRE-EXISTING share is
-- backfilled to APPROVED (metadata-only default fill — no table rewrite), then
-- flip the column default to 'PENDING' so every share created AFTER this
-- migration enters the admin review queue. This matches the Prisma schema's
-- `@default(PENDING)` while keeping legacy shares visible/payable as before.
ALTER TABLE "app"."shares" ADD COLUMN     "approval_status" "app"."ShareApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMPTZ(3),
ADD COLUMN     "reviewed_by_admin_id" INTEGER;

ALTER TABLE "app"."shares" ALTER COLUMN "approval_status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "shares_approval_status_created_at_idx" ON "app"."shares"("approval_status", "created_at");

-- CreateIndex
CREATE INDEX "shares_advertiser_id_approval_status_idx" ON "app"."shares"("advertiser_id", "approval_status");
