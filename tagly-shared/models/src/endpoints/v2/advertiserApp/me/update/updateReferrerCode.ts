import { z } from "zod";
import { ReferralCodeSchema } from "../../../../../core/referrals";

/**
 * `POST /v2/advertisers/me/update/referrer-code` — set who referred this
 * advertiser (they enter the referrer's code). **One-time**, and only within 24h
 * of sign-up. Reuses the canonical `ReferralCodeSchema`.
 */
export const UpdateReferrerCodeBodySchema = z.object({
  referrerCode: ReferralCodeSchema,
});
export type UpdateReferrerCodeBody = z.infer<
  typeof UpdateReferrerCodeBodySchema
>;

export const UpdateReferrerCodeResponseSchema = z.object({
  referrerCode: ReferralCodeSchema,
});
export type UpdateReferrerCodeResponse = z.infer<
  typeof UpdateReferrerCodeResponseSchema
>;
