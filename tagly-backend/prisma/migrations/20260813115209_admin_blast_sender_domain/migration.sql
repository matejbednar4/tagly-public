/*
  Warnings:

  - You are about to drop the column `sender` on the `admin_blast_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "app"."admin_blast_logs" DROP COLUMN "sender",
ADD COLUMN     "sender_domain" TEXT;
