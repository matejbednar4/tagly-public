-- Adds three nullable audit columns to `final_price` so a future "why did
-- this share pay $X?" reconstruction has everything it needs:
--
--   wasSubsidized   = SubsidizationPeriod overlap on share.createdAt
--   subtotalAfterCap = applySharePriceCap(subtotalBeforeCap, wasSubsidized)   ← also stored
--   final_price     = subtotalAfterCap
--                     × (wasSubsidized ? (1 - FLAER_PLATFORM_TAKE_BPS) : 1)
--                     × country_multiplier_bps / 10000
--
-- `subtotal_before_cap_cents` is irreducible — the cap is one-way and you
-- can't reverse it from `final_price_cents` to know what the share would
-- have paid uncapped.
--
-- `subtotal_after_cap_cents` is recoverable in theory (re-run
-- applySharePriceCap with the algoVersion-locked constants) but stored
-- anyway because the pipeline reads linearly: subtotalBefore → cap →
-- subtotalAfter → take + country multiplier → finalPrice. Makes the
-- "did the cap kick?" question a one-line comparison.
--
-- `was_subsidized_at_creation` is intentionally NOT stored — derive from
--   EXISTS(SELECT 1 FROM subsidization_periods sp
--          WHERE sp.local_id = share.local_id
--            AND sp.started_at <= share.created_at
--            AND (sp.ended_at IS NULL OR sp.ended_at >= share.created_at))
-- per CLAUDE.md §Subsidized Share Invariant.
--
-- All three columns are nullable: pre-existing rows can't be backfilled
-- accurately. New FinalPrice rows always populate all three — audit queries
-- can filter with `WHERE subtotal_before_cap_cents IS NOT NULL` to gate to
-- the new-era rows.

ALTER TABLE "app"."final_price"
  ADD COLUMN "subtotal_before_cap_cents" BIGINT,
  ADD COLUMN "subtotal_after_cap_cents"  BIGINT,
  ADD COLUMN "country_multiplier_bps"    INT;
