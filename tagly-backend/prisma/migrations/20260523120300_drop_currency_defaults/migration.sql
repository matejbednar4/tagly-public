-- Drops DEFAULT 'usd' from the four pre-existing currency columns. Every
-- writer now supplies currency explicitly; the safety-net default is no longer
-- needed and removing it forces future code to be deliberate about currency.

ALTER TABLE "app"."final_price"
  ALTER COLUMN "currency" DROP DEFAULT;

ALTER TABLE "app"."transaction_ledger_events"
  ALTER COLUMN "currency" DROP DEFAULT;

ALTER TABLE "app"."stripe_withdrawals"
  ALTER COLUMN "currency" DROP DEFAULT;

ALTER TABLE "app"."stripe_credit_purchases"
  ALTER COLUMN "currency" DROP DEFAULT;
