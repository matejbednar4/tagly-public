-- CreateEnum
CREATE TYPE "app"."CustomerStatus" AS ENUM ('ACTIVE', 'BANNED');

-- AlterTable
ALTER TABLE "app"."customers" ADD COLUMN     "status" "app"."CustomerStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "app"."banned_instagrams" (
    "id" SERIAL NOT NULL,
    "instagram_uid" TEXT NOT NULL,
    "reason" TEXT,
    "banned_by_admin_id" INTEGER,
    "customer_uid" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_instagrams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banned_instagrams_instagram_uid_key" ON "app"."banned_instagrams"("instagram_uid");

