/*
  Warnings:

  - You are about to drop the column `is_subsidized_by_platform` on the `local_subaccounts` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "app"."local_subaccounts" DROP CONSTRAINT "local_subaccounts_advertiser_id_fkey";

-- CreateTable
CREATE TABLE "app"."subsidization_periods" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "subsidization_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subsidization_periods_local_id_idx" ON "app"."subsidization_periods"("local_id");

-- AddForeignKey
ALTER TABLE "app"."subsidization_periods" ADD CONSTRAINT "subsidization_periods_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "app"."local_subaccounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "app"."local_subaccounts" DROP COLUMN "is_subsidized_by_platform",
ALTER COLUMN "advertiser_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "app"."local_subaccounts" ADD CONSTRAINT "local_subaccounts_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
