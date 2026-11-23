import { z } from "zod";

/**
 * `DELETE /v2/advertisers/me/billing/payg` — turn pay-as-you-go off while
 * KEEPING the saved card on file (period closed with reason `DISABLED`). The
 * keep-card counterpart of `DELETE /payg/payment-method`, which removes the
 * card and therefore stops the monthly budget too. In-flight PAYG shares are
 * left as-is (settlement still charges the card for them).
 */

// No request body — the advertiser is taken from the JWT.

export const DisablePaygResponseSchema = z.object({
  /** Always false after the call — PAYG is off. */
  active: z.boolean(),
});
export type DisablePaygResponse = z.infer<typeof DisablePaygResponseSchema>;
