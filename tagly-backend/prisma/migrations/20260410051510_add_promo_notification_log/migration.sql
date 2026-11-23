-- AlterTable
ALTER TABLE "app"."push_tokens" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "app"."promo_notification_logs" (
    "id" SERIAL NOT NULL,
    "event_slug" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" INTEGER,
    "pending_customer_id" INTEGER,

    CONSTRAINT "promo_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promo_notification_logs_customer_id_event_slug_idx" ON "app"."promo_notification_logs"("customer_id", "event_slug");

-- CreateIndex
CREATE INDEX "promo_notification_logs_pending_customer_id_event_slug_idx" ON "app"."promo_notification_logs"("pending_customer_id", "event_slug");

-- CreateIndex
CREATE UNIQUE INDEX "promo_notification_logs_customer_id_event_slug_key" ON "app"."promo_notification_logs"("customer_id", "event_slug");

-- CreateIndex
CREATE UNIQUE INDEX "promo_notification_logs_pending_customer_id_event_slug_key" ON "app"."promo_notification_logs"("pending_customer_id", "event_slug");

-- AddForeignKey
ALTER TABLE "app"."promo_notification_logs" ADD CONSTRAINT "promo_notification_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."promo_notification_logs" ADD CONSTRAINT "promo_notification_logs_pending_customer_id_fkey" FOREIGN KEY ("pending_customer_id") REFERENCES "app"."pending_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
