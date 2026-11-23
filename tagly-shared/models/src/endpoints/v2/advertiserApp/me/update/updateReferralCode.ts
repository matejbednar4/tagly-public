import { z } from "zod";
import { ReferralCodeSchema } from "../../../../../core/referrals";
import { ISODateSchema } from "../../../../../core/time";

/**
 * `POST /v2/advertisers/me/update/referral-code` — change the advertiser's own
 * referral code (the slug others enter to be referred by them). A **one-time**
 * change (locked once set) plus a global uniqueness check. Reuses the canonical
 * `ReferralCodeSchema` (trimmed, lowercased, `[a-z0-9_.-]`, no trailing dot).
 */
export const UpdateReferralCodeBodySchema = z.object({
  referralCode: ReferralCodeSchema,
});
export type UpdateReferralCodeBody = z.infer<
  typeof UpdateReferralCodeBodySchema
>;

export const UpdateReferralCodeResponseSchema = z.object({
  referralCode: ReferralCodeSchema,
  /** When the code was changed — set here, which locks any further change. */
  referralCodeUpdatedAt: ISODateSchema.nullable(),
});
export type UpdateReferralCodeResponse = z.infer<
  typeof UpdateReferralCodeResponseSchema
>;
