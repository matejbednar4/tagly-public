/*
  Warnings:

  - A unique constraint covering the columns `[purpose,admin_id]` on the table `otp_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "app"."AdminRole" AS ENUM ('SUPER', 'SUPPORT', 'OPS');

-- AlterTable
ALTER TABLE "app"."otp_sessions" ADD COLUMN     "admin_id" INTEGER;

-- CreateTable
CREATE TABLE "app"."admins" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "role" "app"."AdminRole" NOT NULL,
    "jwt_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_uid_key" ON "app"."admins"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "app"."admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "app"."admins"("username");

-- CreateIndex
CREATE INDEX "admins_email_idx" ON "app"."admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "otp_sessions_purpose_admin_id_key" ON "app"."otp_sessions"("purpose", "admin_id");

-- CreateIndex
CREATE INDEX "stripe_credit_purchases_status_next_reconcile_at_idx" ON "app"."stripe_credit_purchases"("status", "next_reconcile_at");

-- AddForeignKey
ALTER TABLE "app"."otp_sessions" ADD CONSTRAINT "otp_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "app"."admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
