import { z } from "zod";
import { AdvertiserUidSchema } from "../../../../core/uids";
import { ISODateSchema } from "../../../../core/time";
import { ReferralCodeSchema } from "../../../../core/referrals";

/**
 * `POST /v2/admin/advertisers/:uid/referrer` — record who referred an
 * advertiser, after the fact. The sales-assisted case the in-app endpoint can't
 * cover: an influencer brings a business, sales onboards it, and nobody tells
 * the business to enter the code, so the referral is never created.
 *
 * Same guards as the advertiser's own `POST /v2/advertisers/me/update/referrer-code`
 * minus the 24h sign-up window — but still **set-only**: an advertiser that
 * already has a referrer 409s, so an existing commission relationship can never
 * be redirected from here. Params reuse `AdminAdvertiserUidParamsSchema`.
 */
export const AdminSetAdvertiserReferrerBodySchema = z.object({
  referrerCode: ReferralCodeSchema,
  /** Recorded on the referral event alongside the acting admin, for the audit trail. */
  reason: z.string().trim().max(500).optional(),
});
export type AdminSetAdvertiserReferrerBody = z.infer<
  typeof AdminSetAdvertiserReferrerBodySchema
>;

export const AdminSetAdvertiserReferrerResponseSchema = z.object({
  message: z.string(),
  advertiserUid: AdvertiserUidSchema,
  referrerCode: ReferralCodeSchema,
  referrerUid: z.string(),
  referrerType: z.enum(["customer", "advertiser"]),
  at: ISODateSchema,
});
export type AdminSetAdvertiserReferrerResponse = z.infer<
  typeof AdminSetAdvertiserReferrerResponseSchema
>;
