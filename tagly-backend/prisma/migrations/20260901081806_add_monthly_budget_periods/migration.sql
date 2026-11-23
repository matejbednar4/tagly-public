-- CreateEnum
CREATE TYPE "app"."MonthlyBudgetPeriodEndReason" AS ENUM ('DISABLED', 'TARGET_CHANGED', 'CARD_REMOVED', 'CHARGE_FAILED');

-- AlterEnum
ALTER TYPE "app"."PaygPeriodEndReason" ADD VALUE 'DISABLED';

-- CreateTable
CREATE TABLE "app"."monthly_budget_periods" (
    "id" SERIAL NOT NULL,
    "advertiser_id" INTEGER NOT NULL,
    "target_cents" BIGINT NOT NULL,
    "next_run_at" TIMESTAMPTZ(3),
    "charge_attempts" INTEGER NOT NULL DEFAULT 0,
    "current_attempt_ref" TEXT,
    "last_failure_code" TEXT,
    "last_failure_message" TEXT,
    "upcoming_notice_sent_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "ended_reason" "app"."MonthlyBudgetPeriodEndReason",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "monthly_budget_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_budget_periods_advertiser_id_idx" ON "app"."monthly_budget_periods"("advertiser_id");

-- CreateIndex
CREATE INDEX "monthly_budget_periods_next_run_at_idx" ON "app"."monthly_budget_periods"("next_run_at");

-- AddForeignKey
ALTER TABLE "app"."monthly_budget_periods" ADD CONSTRAINT "monthly_budget_periods_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "app"."advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce "at most one open period per advertiser" (mirrors
-- payg_periods_one_open_per_advertiser). Prisma cannot express partial unique
-- indexes, so it lives only in SQL — openMonthlyBudgetPeriod relies on it via
-- createMany({ skipDuplicates }).
CREATE UNIQUE INDEX "monthly_budget_periods_one_open_per_advertiser"
  ON "app"."monthly_budget_periods" ("advertiser_id")
  WHERE "ended_at" IS NULL;
