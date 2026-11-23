/*
  Warnings:

  - You are about to drop the column `payg_monthly_spend_cap_cents` on the `advertiser_sensitive_data` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "app"."advertiser_sensitive_data" DROP COLUMN "payg_monthly_spend_cap_cents";
