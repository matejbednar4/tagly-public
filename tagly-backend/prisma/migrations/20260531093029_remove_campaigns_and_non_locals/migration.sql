/*
  Warnings:

  - The values [NON_LOCAL_BANNER,NON_LOCAL_PHOTO,CAMPAIGN_STORY] on the enum `PendingMediaPurpose` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `scope` on the `advertiser_types` table. All the data in the column will be lost.
  - You are about to drop the column `non_local_subaccount_id` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `pending_non_local_id` on the `pending_media` table. All the data in the column will be lost.
  - You are about to drop the column `campaign_id` on the `shares` table. All the data in the column will be lost.
  - You are about to drop the column `share_type` on the `shares` table. All the data in the column will be lost.
  - You are about to drop the `_CampaignToLocalSubaccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CampaignToNonLocalSubaccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_LocalSubaccountToPendingCampaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_NonLocalSubaccountToPendingCampaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `campaigns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `non_local_subaccounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pending_campaign_shares` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pending_campaigns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pending_non_local_subaccounts` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "app"."PendingMediaPurpose_new" AS ENUM ('LOCAL_BANNER', 'LOCAL_PHOTO');
ALTER TABLE "app"."pending_media" ALTER COLUMN "purpose" TYPE "app"."PendingMediaPurpose_new" USING ("purpose"::text::"app"."PendingMediaPurpose_new");
ALTER TYPE "app"."PendingMediaPurpose" RENAME TO "PendingMediaPurpose_old";
ALTER TYPE "app"."PendingMediaPurpose_new" RENAME TO "PendingMediaPurpose";
DROP TYPE "app"."PendingMediaPurpose_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "app"."_CampaignToLocalSubaccount" DROP CONSTRAINT "_CampaignToLocalSubaccount_A_fkey";

-- DropForeignKey
ALTER TABLE "app"."_CampaignToLocalSubaccount" DROP CONSTRAINT "_CampaignToLocalSubaccount_B_fkey";

-- DropForeignKey
ALTER TABLE "app"."_CampaignToNonLocalSubaccount" DROP CONSTRAINT "_CampaignToNonLocalSubaccount_A_fkey";

-- DropForeignKey
ALTER TABLE "app"."_CampaignToNonLocalSubaccount" DROP CONSTRAINT "_CampaignToNonLocalSubaccount_B_fkey";

-- DropForeignKey
ALTER TABLE "app"."_LocalSubaccountToPendingCampaign" DROP CONSTRAINT "_LocalSubaccountToPendingCampaign_A_fkey";

-- DropForeignKey
ALTER TABLE "app"."_LocalSubaccountToPendingCampaign" DROP CONSTRAINT "_LocalSubaccountToPendingCampaign_B_fkey";

-- DropForeignKey
ALTER TABLE "app"."_NonLocalSubaccountToPendingCampaign" DROP CONSTRAINT "_NonLocalSubaccountToPendingCampaign_A_fkey";

-- DropForeignKey
ALTER TABLE "app"."_NonLocalSubaccountToPendingCampaign" DROP CONSTRAINT "_NonLocalSubaccountToPendingCampaign_B_fkey";

-- DropForeignKey
ALTER TABLE "app"."campaigns" DROP CONSTRAINT "campaigns_advertiser_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."campaigns" DROP CONSTRAINT "campaigns_story_media_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."campaigns" DROP CONSTRAINT "campaigns_type_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."media" DROP CONSTRAINT "media_non_local_subaccount_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."non_local_subaccounts" DROP CONSTRAINT "non_local_subaccounts_advertiser_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."non_local_subaccounts" DROP CONSTRAINT "non_local_subaccounts_banner_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."non_local_subaccounts" DROP CONSTRAINT "non_local_subaccounts_type_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_campaign_shares" DROP CONSTRAINT "pending_campaign_shares_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_campaign_shares" DROP CONSTRAINT "pending_campaign_shares_customerId_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_campaigns" DROP CONSTRAINT "pending_campaigns_advertiser_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_campaigns" DROP CONSTRAINT "pending_campaigns_story_media_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_campaigns" DROP CONSTRAINT "pending_campaigns_type_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_media" DROP CONSTRAINT "pending_media_pending_non_local_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_non_local_subaccounts" DROP CONSTRAINT "pending_non_local_subaccounts_advertiser_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_non_local_subaccounts" DROP CONSTRAINT "pending_non_local_subaccounts_banner_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."pending_non_local_subaccounts" DROP CONSTRAINT "pending_non_local_subaccounts_type_id_fkey";

-- DropForeignKey
ALTER TABLE "app"."shares" DROP CONSTRAINT "shares_campaign_id_fkey";

-- DropIndex
DROP INDEX "app"."shares_customer_id_campaign_id_key";

-- AlterTable
ALTER TABLE "app"."advertiser_types" DROP COLUMN "scope";

-- AlterTable
ALTER TABLE "app"."media" DROP COLUMN "non_local_subaccount_id";

-- AlterTable
ALTER TABLE "app"."pending_media" DROP COLUMN "pending_non_local_id";

-- AlterTable
ALTER TABLE "app"."shares" DROP COLUMN "campaign_id",
DROP COLUMN "share_type";

-- DropTable
DROP TABLE "app"."_CampaignToLocalSubaccount";

-- DropTable
DROP TABLE "app"."_CampaignToNonLocalSubaccount";

-- DropTable
DROP TABLE "app"."_LocalSubaccountToPendingCampaign";

-- DropTable
DROP TABLE "app"."_NonLocalSubaccountToPendingCampaign";

-- DropTable
DROP TABLE "app"."campaigns";

-- DropTable
DROP TABLE "app"."non_local_subaccounts";

-- DropTable
DROP TABLE "app"."pending_campaign_shares";

-- DropTable
DROP TABLE "app"."pending_campaigns";

-- DropTable
DROP TABLE "app"."pending_non_local_subaccounts";

-- DropEnum
DROP TYPE "app"."AdvertiserScope";

-- DropEnum
DROP TYPE "app"."CampaignStatus";

-- DropEnum
DROP TYPE "app"."PendingCampaignShareStatus";

-- DropEnum
DROP TYPE "app"."ShareType";
