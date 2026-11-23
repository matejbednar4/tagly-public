/*
  Warnings:

  - You are about to drop the column `menu_url` on the `local_subaccounts` table. All the data in the column will be lost.
  - You are about to drop the column `reservation_url` on the `local_subaccounts` table. All the data in the column will be lost.
  - You are about to drop the column `website_url` on the `local_subaccounts` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "app"."LinkStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "app"."local_subaccounts" DROP COLUMN "menu_url",
DROP COLUMN "reservation_url",
DROP COLUMN "website_url",
ADD COLUMN     "menu_link_id" INTEGER,
ADD COLUMN     "reservation_link_id" INTEGER,
ADD COLUMN     "website_link_id" INTEGER;

-- CreateTable
CREATE TABLE "app"."links" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "status" "app"."LinkStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_admin_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "links_url_key" ON "app"."links"("url");

-- CreateIndex
CREATE INDEX "links_status_idx" ON "app"."links"("status");

-- AddForeignKey
ALTER TABLE "app"."local_subaccounts" ADD CONSTRAINT "local_subaccounts_website_link_id_fkey" FOREIGN KEY ("website_link_id") REFERENCES "app"."links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."local_subaccounts" ADD CONSTRAINT "local_subaccounts_reservation_link_id_fkey" FOREIGN KEY ("reservation_link_id") REFERENCES "app"."links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."local_subaccounts" ADD CONSTRAINT "local_subaccounts_menu_link_id_fkey" FOREIGN KEY ("menu_link_id") REFERENCES "app"."links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."links" ADD CONSTRAINT "links_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "app"."admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
