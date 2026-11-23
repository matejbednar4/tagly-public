/*
  Warnings:

  - A unique constraint covering the columns `[advertiser_id,event_slug,channel]` on the table `promo_notification_logs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pending_advertiser_id,event_slug,channel]` on the table `promo_notification_logs` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "app"."AccountType" ADD VALUE 'PENDING_ADVERTISER';

-- AlterTable
ALTER TABLE "app"."promo_notification_logs" ADD COLUMN     "advertiser_id" INTEGER,
ADD COLUMN     "pending_advertiser_id" INTEGER;

-- CreateIndex
CREATE INDEX "promo_notification_logs_advertiser_id_event_slug_idx" ON "app"."promo_notification_logs"("advertiser_id", "event_slug");

-- CreateIndex
CREATE INDEX "promo_notification_logs_pending_advertiser_id_event_slug_idx" ON "app"."promo_notification_logs"("pending_advertiser_id", "event_slug");

-- CreateIndex
CREATE UNIQUE INDEX "promo_notification_logs_advertiser_id_event_slug_channel_key" ON "app"."promo_notification_logs"("advertiser_id", "event_slug", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "promo_notification_logs_pending_advertiser_id_event_slug_ch_key" ON "app"."promo_notification_logs"("pending_advertiser_id", "event_slug", "channel");

-- AddForeignKey
ALTER TABLE "app"."promo_notification_logs" ADD CONSTRAINT "promo_notification_logs_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."promo_notification_logs" ADD CONSTRAINT "promo_notification_logs_pending_advertiser_id_fkey" FOREIGN KEY ("pending_advertiser_id") REFERENCES "app"."pending_advertiser_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
