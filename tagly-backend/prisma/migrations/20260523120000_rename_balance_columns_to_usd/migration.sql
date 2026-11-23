-- Rename balance accumulator columns to be currency-tagged. The data is
-- unchanged (every existing balance is USD). Per-currency tagging future-proofs
-- the schema so additional currencies become additive columns (e.g.
-- balance_czk_cents) rather than an in-place FX conversion.

ALTER TABLE "app"."customer_sensitive_data"
  RENAME COLUMN "balance_cents" TO "balance_usd_cents";

ALTER TABLE "app"."customer_sensitive_data"
  RENAME COLUMN "locked_balance_cents" TO "locked_balance_usd_cents";

ALTER TABLE "app"."advertiser_sensitive_data"
  RENAME COLUMN "available_budget_cents" TO "available_budget_usd_cents";

ALTER TABLE "app"."advertiser_sensitive_data"
  RENAME COLUMN "locked_budget_cents" TO "locked_budget_usd_cents";

ALTER TABLE "app"."advertiser_sensitive_data"
  RENAME COLUMN "total_credit_purchases_cents" TO "total_credit_purchases_usd_cents";

ALTER TABLE "app"."platform_balance"
  RENAME COLUMN "locked_cents" TO "locked_usd_cents";
