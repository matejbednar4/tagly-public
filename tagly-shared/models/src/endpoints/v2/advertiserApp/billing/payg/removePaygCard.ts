import { z } from "zod";

/**
 * `DELETE /v2/advertisers/me/billing/payg/payment-method` — unlink the PAYG
 * card and close the open period (PAYG turns off). In-flight PAYG shares are
 * left as-is; settlement pays the customer in full and lets the advertiser's
 * balance go negative if credits don't cover it. The consent timestamp
 * (`paygChargeAuthorizedAt`) is kept — it's a durable consent record, not tied
 * to the card.
 *
 * @deprecated Back-compat only — builds shipped before 2026-09 unlink through
 * this URL. Current builds use `DELETE /billing/payment-method`
 * (`RemoveSavedCardResponseSchema`). Delete once those builds roll off.
 */

// No request body — the advertiser is taken from the JWT.

export const RemovePaygCardResponseSchema = z.object({
  /** Always false after removal — the card is detached and PAYG is off. */
  active: z.boolean(),
});
export type RemovePaygCardResponse = z.infer<
  typeof RemovePaygCardResponseSchema
>;
