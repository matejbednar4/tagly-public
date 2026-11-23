import { z } from "zod";
import { CentsSchema } from "../../../../../core/money";
import { ISODateSchema } from "../../../../../core/time";
import { MonthlyBudgetPeriodEndReasonSchema } from "../../../../../core/enums";
import { MonthlyBudgetStatusSchema } from "../../../../../dtos/v2/advertiserApp/billing/monthlyBudgetStatus";

/**
 * `GET /v2/advertisers/me/billing/monthly-budget` — the full monthly-budget
 * state backing the MonthlyBudgetSheet. Pure read. The card itself is on
 * `GET /billing/payment-method` (shared with PAYG).
 */

// No request body — the advertiser is taken from the JWT.

export const GetMonthlyBudgetResponseSchema = z.object({
  /** Server-derived state — render the pill/notes from this. */
  status: MonthlyBudgetStatusSchema,
  /** An open period exists — the monthly top-up is on. */
  active: z.boolean(),
  /** The monthly target; null unless active. */
  targetCents: CentsSchema.nullable(),
  /** When the next top-up runs (or retries); null unless active. */
  nextChargeAt: ISODateSchema.nullable(),
  /**
   * True while a declined charge is waiting for its backed-off retry (the
   * period is still active). Show "we'll retry your card" instead of the
   * plain next-charge line.
   */
  pendingRetry: z.boolean(),
  /**
   * Why the most recent period closed (null when none ever closed). With a
   * card on file and `active: false`, `CHARGE_FAILED` means the card declined
   * past the retry limit — prompt the advertiser to update it.
   */
  lastEndedReason: MonthlyBudgetPeriodEndReasonSchema.nullable(),
  /** A saved off-session card is on file (required to enable). */
  hasCard: z.boolean(),
});
export type GetMonthlyBudgetResponse = z.infer<
  typeof GetMonthlyBudgetResponseSchema
>;
