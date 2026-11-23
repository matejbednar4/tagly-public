-- CreateEnum
CREATE TYPE "app"."BlastAudience" AS ENUM ('PROMO_OPTED_IN', 'EVERYONE');

-- AlterTable
ALTER TABLE "app"."admin_blast_logs" ADD COLUMN     "audience" "app"."BlastAudience",
ADD COLUMN     "slug" TEXT;
