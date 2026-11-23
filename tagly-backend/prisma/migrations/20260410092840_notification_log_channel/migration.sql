/*
  Warnings:

  - A unique constraint covering the columns `[customer_id,event_slug,channel]` on the table `promo_notification_logs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pending_customer_id,event_slug,channel]` on the table `promo_notification_logs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `channel` to the `promo_notification_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "app"."promo_notification_logs_customer_id_event_slug_key";

-- DropIndex
DROP INDEX "app"."promo_notification_logs_pending_customer_id_event_slug_key";

-- AlterTable
ALTER TABLE "app"."promo_notification_logs" ADD COLUMN     "channel" "app"."NotificationChannel" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "promo_notification_logs_customer_id_event_slug_channel_key" ON "app"."promo_notification_logs"("customer_id", "event_slug", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "promo_notification_logs_pending_customer_id_event_slug_chan_key" ON "app"."promo_notification_logs"("pending_customer_id", "event_slug", "channel");
