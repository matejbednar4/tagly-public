-- AlterTable
ALTER TABLE "app"."local_subaccounts" ADD COLUMN     "is_subsidized_by_platform" BOOLEAN NOT NULL DEFAULT false;
