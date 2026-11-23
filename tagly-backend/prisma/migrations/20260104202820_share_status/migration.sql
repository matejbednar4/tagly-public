/*
  Warnings:

  - The values [PENDING_REVIEW] on the enum `ShareStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "app"."ShareStatus_new" AS ENUM ('PRE_INSIGHTS', 'PRE_SNAPSHOT', 'POST_SNAPSHOT', 'PAID', 'REJECTED', 'UNPAYABLE');
ALTER TABLE "app"."shares" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "app"."shares" ALTER COLUMN "status" TYPE "app"."ShareStatus_new" USING ("status"::text::"app"."ShareStatus_new");
ALTER TYPE "app"."ShareStatus" RENAME TO "ShareStatus_old";
ALTER TYPE "app"."ShareStatus_new" RENAME TO "ShareStatus";
DROP TYPE "app"."ShareStatus_old";
ALTER TABLE "app"."shares" ALTER COLUMN "status" SET DEFAULT 'PRE_INSIGHTS';
COMMIT;
