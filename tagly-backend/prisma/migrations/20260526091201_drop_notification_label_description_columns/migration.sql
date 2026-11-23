/*
  Warnings:

  - You are about to drop the column `advertiser_description` on the `notification_categories` table. All the data in the column will be lost.
  - You are about to drop the column `customer_description` on the `notification_categories` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `notification_categories` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `notification_events` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `notification_events` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "app"."notification_events_label_idx";

-- AlterTable
ALTER TABLE "app"."notification_categories" DROP COLUMN "advertiser_description",
DROP COLUMN "customer_description",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "app"."notification_events" DROP COLUMN "description",
DROP COLUMN "label";
