import { z } from "zod";
import { MONTHLY_BUDGET } from "../../../../../constants/billing/MONTHLY_BUDGET";

/**
 * `PUT /v2/advertisers/me/billing/monthly-budget` — set the monthly budget
 * to `targetCents`. Requires a saved card (link it via
 * `/billing/payment-method/setup-intent` first — error 1350 otherwise).
 *
 * Periods are immutable: enabling opens one, a different target closes the
 * open one and opens a new one, the same target is a no-op. A newly opened
 * period is **due immediately**: the stripe worker (the only thing that ever
 * charges) picks it up on its next tick and tops the advertiser up to the
 * target — `target − available` (a business enables this because they are
 * out of credits; a raise pays the difference; a lower target charges
 * nothing). The response only confirms the period is open (the twin of
 * `POST /payg`); clients then poll `GET /monthly-budget` until `nextChargeAt`
 * has moved into a later month (done), `pendingRetry` is set (declined,
 * retrying), or the status is `CARD_FAILED` (paused). Clients state the
 * expected amount on the CTA before the tap (same `availableCents` +
 * `MONTHLY_BUDGET.MIN_TOPUP_CENTS` rule the worker applies).
 */
export const SetMonthlyBudgetBodySchema = z.object({
  /** The level to restore available credits to on the 1st of each month. */
  targetCents: z
    .number()
    .int()
    .min(MONTHLY_BUDGET.MIN_TARGET_CENTS)
    .max(MONTHLY_BUDGET.MAX_TARGET_CENTS),
  /**
   * Explicit consent to the recurring merchant-initiated charge. Must be
   * `true` — the moment the advertiser agrees to "charge my saved card on the
   * 1st of each month". Re-stamps the off-session authorization.
   */
  chargeAuthorized: z.literal(true),
});
export type SetMonthlyBudgetBody = z.infer<typeof SetMonthlyBudgetBodySchema>;

export const SetMonthlyBudgetResponseSchema = z.object({
  /** Always true after the call — a period is open at the requested target. */
  active: z.boolean(),
});
export type SetMonthlyBudgetResponse = z.infer<
  typeof SetMonthlyBudgetResponseSchema
>;
