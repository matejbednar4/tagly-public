-- Rename delta_platform_revenue_cents → delta_platform_cents
-- Add delta_platform_locked_cents for tracking in-flight subsidized share locks
ALTER TABLE "app"."transaction_ledger_events"
  RENAME COLUMN "delta_platform_revenue_cents" TO "delta_platform_cents";

ALTER TABLE "app"."transaction_ledger_events"
  ADD COLUMN "delta_platform_locked_cents" BIGINT NOT NULL DEFAULT 0;
