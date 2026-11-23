import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";

/**
 * Server-derived monthly-budget status — the single wire value clients render
 * the feature's state from, so the rules live only in the backend
 * (`utils/hydrators/billing/deriveMonthlyBudgetStatus.ts`), the twin of
 * `PaygStatus`.
 *
 * - `NOT_ACTIVE`   never enabled, turned off, or the saved card was removed.
 * - `ACTIVE`       an open period — on the 1st of each month the saved card is
 *                  charged `target − available` (retries after a decline keep
 *                  it ACTIVE; see `pendingRetry` on the state endpoint).
 * - `CARD_FAILED`  the last period was closed because the charge declined past
 *                  the retry limit ("paused") and a card is still on file.
 *                  Prompt "update your card and turn it back on".
 */
export const MonthlyBudgetStatusValues = [
  "NOT_ACTIVE",
  "ACTIVE",
  "CARD_FAILED",
] as const;
export const MonthlyBudgetStatusSchema = z.enum(MonthlyBudgetStatusValues);
export type MonthlyBudgetStatus = z.infer<typeof MonthlyBudgetStatusSchema>;

/**
 * The lean monthly-budget slice embedded on `AdvertiserMe.budgets` — enough
 * for the Home / Wallet cards ("$200 / month · next Oct 1"). The full state
 * (card, last end reason, retry) lives on
 * `GET /v2/advertisers/me/billing/monthly-budget`.
 */
export const MonthlyBudgetSummarySchema = z.object({
  status: MonthlyBudgetStatusSchema,
  /** The monthly target; null unless ACTIVE. */
  targetCents: CentsSchema.nullable(),
  /** When the next top-up runs; null unless ACTIVE. */
  nextChargeAt: ISODateSchema.nullable(),
});
export type MonthlyBudgetSummary = z.infer<typeof MonthlyBudgetSummarySchema>;
