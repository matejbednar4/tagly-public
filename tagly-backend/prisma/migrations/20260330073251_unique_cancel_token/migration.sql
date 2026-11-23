/*
  Warnings:

  - A unique constraint covering the columns `[cancel_token]` on the table `pending_customers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "pending_customers_cancel_token_key" ON "app"."pending_customers"("cancel_token");
