import { z } from "zod";

/**
 * `POST /v2/customers/me/update/marketing-consent` — set the logged-in
 * customer's marketing-consent flag. One flag gates BOTH promo channels (email +
 * push), so this is the in-app opt-out Apple Guideline 4.5.4 requires. No
 * cooldown — the customer can toggle it freely.
 */
export const UpdateMarketingConsentBodySchema = z.object({
  promoNotificationsEnabled: z.boolean(),
});
export type UpdateMarketingConsentBody = z.infer<
  typeof UpdateMarketingConsentBodySchema
>;

export const UpdateMarketingConsentResponseSchema = z.object({
  promoNotificationsEnabled: z.boolean(),
});
export type UpdateMarketingConsentResponse = z.infer<
  typeof UpdateMarketingConsentResponseSchema
>;
