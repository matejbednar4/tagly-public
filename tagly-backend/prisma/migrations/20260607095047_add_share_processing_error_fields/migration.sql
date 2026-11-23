-- AlterTable
ALTER TABLE "app"."shares" ADD COLUMN     "last_processing_error" TEXT,
ADD COLUMN     "last_processing_error_at" TIMESTAMPTZ(3);
