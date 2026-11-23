import { z } from "zod";

/**
 * `DELETE /v2/advertisers/me/billing/monthly-budget` — turn the monthly
 * budget off (period closed with reason `DISABLED`). The saved card stays on
 * file (and pay-as-you-go, if on, keeps running); removing the card is
 * `DELETE /payg/payment-method`, which stops both features.
 */

// No request body — the advertiser is taken from the JWT.

export const DisableMonthlyBudgetResponseSchema = z.object({
  /** Always false after the call — the monthly budget is off. */
  active: z.boolean(),
});
export type DisableMonthlyBudgetResponse = z.infer<
  typeof DisableMonthlyBudgetResponseSchema
>;
