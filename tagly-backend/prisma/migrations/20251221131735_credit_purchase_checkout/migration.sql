/*
  Warnings:

  - A unique constraint covering the columns `[stripe_checkout_session_id]` on the table `stripe_credit_purchases` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "app"."stripe_credit_purchases" ADD COLUMN     "last_reconcile_attempt_at" TIMESTAMPTZ(3),
ADD COLUMN     "next_reconcile_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reconcile_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripe_checkout_session_id" TEXT,
ALTER COLUMN "stripe_payment_intent_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "stripe_credit_purchases_stripe_checkout_session_id_key" ON "app"."stripe_credit_purchases"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "stripe_credit_purchases_stripe_checkout_session_id_idx" ON "app"."stripe_credit_purchases"("stripe_checkout_session_id");
