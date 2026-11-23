import { z } from "zod";

/**
 * `POST /v2/advertisers/me/billing/payg/reconcile` — after the PaymentSheet
 * confirms the PAYG SetupIntent, link the saved card immediately (save
 * `savedPaymentMethodId` + open the PaygPeriod) instead of waiting for the
 * `setup_intent.succeeded` webhook mirror. Idempotent with the webhook —
 * whichever runs first wins.
 *
 * @deprecated Back-compat only — builds shipped before 2026-09 reconcile the
 * PAYG link through this URL. Current builds use
 * `/billing/payment-method/reconcile`. Delete once those builds roll off.
 */
export const ReconcilePaygCardBodySchema = z.object({
  /** The SetupIntent id returned by `/payg/setup-intent`. */
  setupIntentId: z.string().min(1),
});
export type ReconcilePaygCardBody = z.infer<typeof ReconcilePaygCardBodySchema>;

export const ReconcilePaygCardResponseSchema = z.object({
  /** True once the card from the succeeded SetupIntent is saved. */
  linked: z.boolean(),
});
export type ReconcilePaygCardResponse = z.infer<
  typeof ReconcilePaygCardResponseSchema
>;
