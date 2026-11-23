-- AlterTable
ALTER TABLE "app"."stripe_credit_purchases" ADD COLUMN     "external_ref" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stripe_credit_purchases_external_ref_key" ON "app"."stripe_credit_purchases"("external_ref");

