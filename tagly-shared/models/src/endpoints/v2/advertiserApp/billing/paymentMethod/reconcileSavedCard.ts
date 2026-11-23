import { z } from "zod";

/**
 * `POST /v2/advertisers/me/billing/payment-method/reconcile` — after the
 * PaymentSheet confirms a `card_setup` SetupIntent, save the card immediately
 * instead of waiting for the `setup_intent.succeeded` webhook mirror.
 * Idempotent with the webhook — whichever runs first wins. Saves the card
 * ONLY; no feature period is opened (unlike `/payg/reconcile`).
 */
export const ReconcileSavedCardBodySchema = z.object({
  /** The SetupIntent id returned by `/payment-method/setup-intent`. */
  setupIntentId: z.string().min(1),
});
export type ReconcileSavedCardBody = z.infer<
  typeof ReconcileSavedCardBodySchema
>;

export const ReconcileSavedCardResponseSchema = z.object({
  /** True once the card from the succeeded SetupIntent is saved. */
  linked: z.boolean(),
});
export type ReconcileSavedCardResponse = z.infer<
  typeof ReconcileSavedCardResponseSchema
>;
