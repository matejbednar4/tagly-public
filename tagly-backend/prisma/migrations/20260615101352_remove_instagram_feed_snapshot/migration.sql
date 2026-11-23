/*
  Warnings:

  - You are about to drop the `instagram_feed_snapshots` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "app"."instagram_feed_snapshots" DROP CONSTRAINT "instagram_feed_snapshots_instagram_id_fkey";

-- DropTable
DROP TABLE "app"."instagram_feed_snapshots";
