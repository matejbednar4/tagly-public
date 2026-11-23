-- AlterTable
ALTER TABLE "app"."push_tokens" ADD COLUMN     "pending_advertiser_id" INTEGER;

-- CreateIndex
CREATE INDEX "push_tokens_pending_advertiser_id_idx" ON "app"."push_tokens"("pending_advertiser_id");

-- AddForeignKey
ALTER TABLE "app"."push_tokens" ADD CONSTRAINT "push_tokens_pending_advertiser_id_fkey" FOREIGN KEY ("pending_advertiser_id") REFERENCES "app"."pending_advertiser_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
