-- =============================================================================
-- Pay-as-you-go (PAYG) — complete setup
-- Squashed from five intermediate migrations that were never applied to prod.
-- =============================================================================

-- New enums -------------------------------------------------------------------

CREATE TYPE "app"."PaygPeriodEndReason" AS ENUM ('CARD_REMOVED', 'CHARGE_FAILED');

CREATE TYPE "app"."ShareFundingMode" AS ENUM ('CREDITS', 'PAYG', 'SUBSIDIZED');

-- Discriminates a StripeCreditPurchase row: a prepaid credit top-up vs a PAYG
-- off-session settlement charge. PAYG charges are non-refundable.
CREATE TYPE "app"."CreditPurchaseKind" AS ENUM ('CREDIT_PURCHASE', 'PAYG_CHARGE');

-- Extend TransactionKind (card charge event) ----------------------------------

ALTER TYPE "app"."TransactionKind" ADD VALUE 'PAYG_CHARGE';

-- PAYG settings on advertiser_sensitive_data ----------------------------------
-- payg_charge_authorized_at: when the advertiser explicitly authorised
--   Flaer to charge their card off-session (Stripe MIT mandate consent).
--   Captured at setup-intent time, before the Stripe redirect.
-- payg_payment_method_id: the card currently linked for PAYG (off-session
--   mandate only — distinct from defaultPaymentMethodId used for credit
--   purchases, which carries no MIT mandate).
-- payg_monthly_spend_cap_cents: optional per-calendar-month spend ceiling.

ALTER TABLE "app"."advertiser_sensitive_data"
  ADD COLUMN "payg_charge_authorized_at"  TIMESTAMPTZ(3),
  ADD COLUMN "payg_payment_method_id"     TEXT,
  ADD COLUMN "payg_monthly_spend_cap_cents" BIGINT;

-- PAYG settlement columns on shares -------------------------------------------
-- funding_mode_at_creation: immutable per-share classification set at
--   creation time (CREDITS | PAYG | SUBSIDIZED). Used by the settlement worker
--   to determine the correct payout path without re-querying SubsidizationPeriods.
-- payg_charge_attempts / payg_next_retry_at: settlement retry bookkeeping for
--   live PAYG shares whose card charge declined.
-- stripe_payment_intent_id: the PAYG settlement-charge PI for audit.

ALTER TABLE "app"."shares"
  ADD COLUMN "funding_mode_at_creation" "app"."ShareFundingMode",
  ADD COLUMN "payg_charge_attempts"     INTEGER,
  ADD COLUMN "payg_next_retry_at"       TIMESTAMPTZ(3),
  ADD COLUMN "stripe_payment_intent_id" TEXT;

-- Backfill funding_mode_at_creation -------------------------------------------
-- A share is SUBSIDIZED iff a SubsidizationPeriod overlapped its created_at
-- (same predicate as the settlement worker). All other shares → CREDITS.
-- No live PAYG shares exist at migration time. Shares with a NULL local_id
-- (e.g. legacy campaign shares) never match the EXISTS and fall to CREDITS.

UPDATE "app"."shares" s
SET "funding_mode_at_creation" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM   "app"."subsidization_periods" sp
    WHERE  sp."local_id"    = s."local_id"
      AND  sp."started_at" <= s."created_at"
      AND  (sp."ended_at" IS NULL OR sp."ended_at" >= s."created_at")
  ) THEN 'SUBSIDIZED'::"app"."ShareFundingMode"
  ELSE       'CREDITS'::"app"."ShareFundingMode"
END;

-- Now enforce NOT NULL — every existing row has been classified above.
ALTER TABLE "app"."shares"
  ALTER COLUMN "funding_mode_at_creation" SET NOT NULL;

-- stripe_credit_purchases: drop unused fee/net columns, add PAYG surcharge ----
-- fee_cents / net_cents were stored as a convenience copy of Stripe's balance
-- data but are never used for any business logic — Stripe Dashboard is the
-- authoritative source. paygSurchargeCents is the fixed per-charge surcharge
-- passed to the advertiser (PAYG off-session charges only).

ALTER TABLE "app"."stripe_credit_purchases"
  DROP COLUMN "fee_cents",
  DROP COLUMN "net_cents",
  ADD  COLUMN "payg_surcharge_cents" BIGINT,
  ADD  COLUMN "kind" "app"."CreditPurchaseKind";

-- Backfill kind: PAYG isn't live yet, so every existing row is a regular
-- credit purchase.
UPDATE "app"."stripe_credit_purchases"
SET "kind" = 'CREDIT_PURCHASE'
WHERE "kind" IS NULL;

-- Now enforce NOT NULL — every existing row has been classified above and all
-- creation sites set kind explicitly.
ALTER TABLE "app"."stripe_credit_purchases"
  ALTER COLUMN "kind" SET NOT NULL;

-- PAYG periods table ----------------------------------------------------------
-- One row per card-link period. paymentMethodId records which card was active
-- for audit; endedReason tracks why the period closed.

CREATE TABLE "app"."payg_periods" (
  "id"                SERIAL          NOT NULL,
  "advertiser_id"     INTEGER         NOT NULL,
  "payment_method_id" TEXT            NOT NULL,
  "started_at"        TIMESTAMPTZ(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at"          TIMESTAMPTZ(3),
  "ended_reason"      "app"."PaygPeriodEndReason",
  "created_at"        TIMESTAMPTZ(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMPTZ(3)  NOT NULL,

  CONSTRAINT "payg_periods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payg_periods_advertiser_id_idx"
  ON "app"."payg_periods" ("advertiser_id");

-- Enforce "at most one open period per advertiser" at the database level. The
-- success-page reconcile call and the setup_intent.succeeded webhook both open a
-- period on every card link and can race; openPaygPeriod relies on this partial
-- unique index (INSERT ... ON CONFLICT DO NOTHING) so the loser no-ops instead of
-- duplicating. Prisma's schema language can't express a partial (WHERE) index, so
-- it lives here in raw SQL; Prisma ignores objects it can't represent and will
-- not try to drop it.
CREATE UNIQUE INDEX "payg_periods_one_open_per_advertiser"
  ON "app"."payg_periods" ("advertiser_id")
  WHERE "ended_at" IS NULL;

ALTER TABLE "app"."payg_periods"
  ADD CONSTRAINT "payg_periods_advertiser_id_fkey"
  FOREIGN KEY ("advertiser_id")
  REFERENCES "app"."advertisers" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
