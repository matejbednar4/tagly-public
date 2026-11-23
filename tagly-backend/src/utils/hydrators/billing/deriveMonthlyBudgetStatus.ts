import type { MonthlyBudgetPeriodEndReason } from "@tagly/models/shared";
import type { MonthlyBudgetStatus } from "@tagly/models/v2/advertiserApp";

/**
 * The single derivation of the wire `MonthlyBudgetStatus` — used by both
 * `GET /v2/advertisers/me` (budgets) and
 * `GET /v2/advertisers/me/billing/monthly-budget`, so clients never
 * re-implement the rules (the twin of `derivePaygStatus`):
 *
 * - open period                              → ACTIVE
 * - no open period, card on file, and the
 *   last period closed on CHARGE_FAILED      → CARD_FAILED ("paused — update
 *                                              your card")
 * - otherwise                                → NOT_ACTIVE (never enabled, or
 *                                              turned off / card removed)
 *
 * Unlike PAYG, a card on file with no open period is NOT automatically a
 * failure: the monthly budget can be turned off while keeping the card
 * (`DISABLED`), so the last end reason is what separates the two.
 */
export function deriveMonthlyBudgetStatus({
  cardOnFile,
  periodOpen,
  lastEndedReason,
}: {
  cardOnFile: boolean;
  periodOpen: boolean;
  lastEndedReason: MonthlyBudgetPeriodEndReason | null;
}): MonthlyBudgetStatus {
  if (periodOpen) return "ACTIVE";
  if (cardOnFile && lastEndedReason === "CHARGE_FAILED") return "CARD_FAILED";
  return "NOT_ACTIVE";
}
