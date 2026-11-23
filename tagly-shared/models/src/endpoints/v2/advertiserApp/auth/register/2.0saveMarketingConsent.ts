import { z } from "zod";

/**
 * `POST /v2/public/auth/advertisers/save-marketing-consent` — persist the
 * advertiser's marketing-notifications choice onto the PendingAdvertiserAccount.
 *
 * Backs the dedicated promo screen shown after OTP / OAuth. It is a separate,
 * explicit, unbundled opt-in (GDPR Art 4(11)) shown to **every** locale — both
 * answers are recorded, and an unanswered choice resolves to opted-out at
 * promotion. Keyed by `registrationToken`.
 */
export const SaveMarketingConsentBodySchema = z.object({
  registrationToken: z.string().min(1),
  promoNotificationsEnabled: z.boolean(),
});
export type SaveMarketingConsentBody = z.infer<
  typeof SaveMarketingConsentBodySchema
>;

/** Response */
export const SaveMarketingConsentResponseSchema = z.object({
  message: z.string(),
});
export type SaveMarketingConsentResponse = z.infer<
  typeof SaveMarketingConsentResponseSchema
>;
