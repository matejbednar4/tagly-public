import { z } from "zod";

/**
 * `POST /v2/advertisers/me/billing/payg` — turn pay-as-you-go on using the
 * saved card already on file (no new SetupIntent / PaymentSheet). The
 * counterpart of `DELETE /payg` (turn off, keep card), and the path for an
 * advertiser whose card was linked for the monthly budget. Requires a saved
 * card (1350 otherwise). Re-stamps the off-session charge authorization.
 */
export const EnablePaygBodySchema = z.object({
  /**
   * Explicit consent to PAYG's off-session charges (+ the per-charge
   * surcharge). Must be `true` — the moment the advertiser agrees. EU/UK
   * requires a checkbox; US captures it via the disclosure note.
   */
  chargeAuthorized: z.literal(true),
});
export type EnablePaygBody = z.infer<typeof EnablePaygBodySchema>;

export const EnablePaygResponseSchema = z.object({
  /** Always true after the call — PAYG is on. */
  active: z.boolean(),
});
export type EnablePaygResponse = z.infer<typeof EnablePaygResponseSchema>;
