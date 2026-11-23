import { z } from "zod";
import { SetupPaygCardResponseSchema } from "../payg/setupPaygCard";

/**
 * `POST /v2/advertisers/me/billing/payment-method/setup-intent` — start
 * linking (or replacing) the account's saved off-session card WITHOUT
 * turning any feature on. The purpose-neutral twin of `/payg/setup-intent`
 * (which also opens a PaygPeriod once the sheet succeeds): used when the card
 * is being added for the monthly budget. Stamps the off-session charge
 * authorization, then returns a bare SetupIntent (+ Stripe customer &
 * ephemeral key) for the native PaymentSheet.
 */
export const SetupSavedCardBodySchema = z.object({
  /**
   * Explicit consent to off-session (merchant-initiated) charges on the saved
   * card. Must be `true` — this is the moment the advertiser agrees, before
   * the sheet opens. EU/UK requires a checkbox; US captures it via the
   * disclosure note.
   */
  chargeAuthorized: z.literal(true),
});
export type SetupSavedCardBody = z.infer<typeof SetupSavedCardBodySchema>;

/** Same PaymentSheet handoff as the PAYG setup — one shape, one definition. */
export const SetupSavedCardResponseSchema = SetupPaygCardResponseSchema;
export type SetupSavedCardResponse = z.infer<
  typeof SetupSavedCardResponseSchema
>;
