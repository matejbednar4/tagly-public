import { z } from "zod";
import { ReferralCodeSchema } from "../../../../../core/referrals";

/**
 * `POST /v2/public/auth/customers/attach-referrer` — attach a referrer code to
 * the verified PendingCustomer. Called by the client **only when the user
 * arrived via a referral** (a deeplink-carried code), once it has a
 * `registrationToken` (post-OTP / post-OAuth).
 *
 * Kept separate from `save-profile` so referral attribution isn't coupled to the
 * profile form. The code is stored raw and resolved into the actual referral at
 * `complete-registration` (an unknown/inactive code is silently ignored there).
 */
export const AttachReferrerBodySchema = z.object({
  registrationToken: z.string().min(1),
  referrerCode: ReferralCodeSchema,
});
export type AttachReferrerBody = z.infer<typeof AttachReferrerBodySchema>;

/** Response */
export const AttachReferrerResponseSchema = z.object({
  message: z.string(),
});
export type AttachReferrerResponse = z.infer<
  typeof AttachReferrerResponseSchema
>;
