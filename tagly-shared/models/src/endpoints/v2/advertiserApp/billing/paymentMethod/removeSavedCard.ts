import { z } from "zod";

/**
 * `DELETE /v2/advertisers/me/billing/payment-method` — unlink the account's
 * saved off-session card. The card is shared by pay-as-you-go and the
 * monthly budget, so removing it turns BOTH off (their periods close with
 * `CARD_REMOVED`) and detaches the card at Stripe. Turning one feature off
 * while keeping the card is that feature's own `DELETE`. In-flight PAYG
 * shares are left as-is; settlement pays the customer in full and lets the
 * advertiser's balance go negative if credits don't cover it. The consent
 * timestamp is kept — it's a durable consent record, not tied to the card.
 */

// No request body — the advertiser is taken from the JWT.

export const RemoveSavedCardResponseSchema = z.object({
  /** Always false after removal. */
  hasCard: z.boolean(),
});
export type RemoveSavedCardResponse = z.infer<
  typeof RemoveSavedCardResponseSchema
>;
