-- AlterTable
ALTER TABLE "app"."referral_events" ADD COLUMN     "admin_reason" TEXT,
ADD COLUMN     "set_by_admin_id" INTEGER;

-- AddForeignKey
ALTER TABLE "app"."referral_events" ADD CONSTRAINT "referral_events_set_by_admin_id_fkey" FOREIGN KEY ("set_by_admin_id") REFERENCES "app"."admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
