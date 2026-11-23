import { z } from "zod";

/**
 * `POST /v2/public/auth/advertisers/finish-registration` — promote the
 * PendingAdvertiserAccount to an Advertiser. Returns a session JWT (HTTP 201).
 *
 * Unlike the customer flow this is **not** the last onboarding step and carries
 * no profile data: the advertiser account is created first (bare — no business
 * setup), and business/profile + local-subaccount setup happen afterwards on the
 * authenticated account. All the promotion needs is the pending account's
 * `registrationToken` (email already verified at OTP/OAuth; consent already on
 * the pending row).
 */
export const FinishRegistrationBodySchema = z.object({
  registrationToken: z.string().min(1),
});
export type FinishRegistrationBody = z.infer<
  typeof FinishRegistrationBodySchema
>;

/** `{ jwt }` for the freshly-created Advertiser (HTTP 201). */
export const FinishRegistrationResponseSchema = z.object({
  jwt: z.string(),
});
export type FinishRegistrationResponse = z.infer<
  typeof FinishRegistrationResponseSchema
>;
