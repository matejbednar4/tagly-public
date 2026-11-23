import { z } from "zod";

/**
 * `POST /v2/advertisers/me/billing/payg/setup-intent` — start linking a card
 * for pay-as-you-go. Stamps the off-session charge authorization, then returns
 * a bare SetupIntent (+ Stripe customer & ephemeral key) for the native
 * PaymentSheet (no hosted Checkout / browser return URL).
 *
 * @deprecated Back-compat only — builds shipped before 2026-09 link the PAYG
 * card through this (`purpose: payg_setup`, which also opens the period).
 * Current builds use `/billing/payment-method/setup-intent` + `POST /payg`.
 * Delete once those builds roll off.
 */
export const SetupPaygCardBodySchema = z.object({
  /**
   * Explicit consent to the PAYG off-session charge authorization. Must be
   * `true` — this is the moment the advertiser agrees, before the sheet opens.
   * EU/UK requires a checkbox; US captures it via the disclosure note.
   */
  paygChargeAuthorizedAt: z.literal(true),
});
export type SetupPaygCardBody = z.infer<typeof SetupPaygCardBodySchema>;

export const SetupPaygCardResponseSchema = z.object({
  /** Client secret the PaymentSheet confirms (setup mode). */
  setupIntentClientSecret: z.string().min(1),
  /** The SetupIntent id — passed back to `/payg/reconcile` after sheet success. */
  setupIntentId: z.string().min(1),
  /** The advertiser's Stripe customer id (PaymentSheet customer mode). */
  customerId: z.string().min(1),
  /** Short-lived key letting the PaymentSheet act on the customer. */
  ephemeralKeySecret: z.string().min(1),
});
export type SetupPaygCardResponse = z.infer<typeof SetupPaygCardResponseSchema>;
