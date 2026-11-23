/*
  Warnings:

  - The values [PRE_INSIGHTS,PRE_SNAPSHOT,POST_SNAPSHOT,REJECTED] on the enum `ShareStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;

-- Backfill (hand-added, must run BEFORE the cast): carry rejection to the surviving
-- moderation axis before the cast folds status='REJECTED' into 'PROCESSING', or the
-- rejection fact is lost. Orphan-safety only — admin-rejected rows already carry
-- approval_status='REJECTED' and report-rejected rows carry a VALID ShareReport;
-- this catches any inconsistent REJECTED-status row so it can never silently become
-- an APPROVED PROCESSING share the payment worker would pay.
UPDATE "app"."shares" s
SET "approval_status" = 'REJECTED'
WHERE s."status" = 'REJECTED'
  AND s."approval_status" <> 'REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM "app"."share_reports" r
    WHERE r."shareId" = s."id" AND r."status" = 'VALID'
  );

CREATE TYPE "app"."ShareStatus_new" AS ENUM ('PROCESSING', 'PAID', 'UNPAYABLE');
ALTER TABLE "app"."shares" ALTER COLUMN "status" DROP DEFAULT;
-- Fold the four dropped values into PROCESSING inside the cast (a naive
-- "status"::text::ShareStatus_new would throw on any row still holding them).
ALTER TABLE "app"."shares" ALTER COLUMN "status" TYPE "app"."ShareStatus_new" USING (
  CASE "status"::text
    WHEN 'PRE_INSIGHTS'  THEN 'PROCESSING'
    WHEN 'PRE_SNAPSHOT'  THEN 'PROCESSING'
    WHEN 'POST_SNAPSHOT' THEN 'PROCESSING'
    WHEN 'REJECTED'      THEN 'PROCESSING'
    ELSE "status"::text          -- 'PAID' / 'UNPAYABLE' pass through
  END::"app"."ShareStatus_new"
);
ALTER TYPE "app"."ShareStatus" RENAME TO "ShareStatus_old";
ALTER TYPE "app"."ShareStatus_new" RENAME TO "ShareStatus";
DROP TYPE "app"."ShareStatus_old";
ALTER TABLE "app"."shares" ALTER COLUMN "status" SET DEFAULT 'PROCESSING';
COMMIT;
