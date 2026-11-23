import { z } from "zod";

/**
 * `POST /v2/public/auth/advertisers/pending-push-token` — register an Expo push
 * token against a PendingAdvertiserAccount (so pre-registration nudges can reach
 * advertisers who drop off mid-onboarding). The token auto-migrates to the
 * Advertiser when registration completes.
 */
export const RegisterPendingPushTokenBodySchema = z.object({
  registrationToken: z.string().min(1),
  token: z.string().min(1),
  /**
   * Device-reported IANA timezone (`Intl…resolvedOptions().timeZone`). Optional
   * for back-compat; without it the backend schedules promo quiet hours from
   * the locale's market-default zone, which is wrong outside its home timezone.
   */
  timezone: z.string().min(1).max(64).optional(),
});
export type RegisterPendingPushTokenBody = z.infer<
  typeof RegisterPendingPushTokenBodySchema
>;

/** Response */
export const RegisterPendingPushTokenResponseSchema = z.object({
  message: z.string(),
});
export type RegisterPendingPushTokenResponse = z.infer<
  typeof RegisterPendingPushTokenResponseSchema
>;
