import { z } from "zod";
import { AdvertiserReferralsSchema } from "../../../../dtos/v2/advertiserApp/me/advertiserReferrals";

/**
 * `GET /v2/advertisers/me/referrals` — the advertiser's referral code, status,
 * referrer, referred counts, and lifetime referral earnings. Authed (JWT); pure
 * read. Split out of `/me` so it can be fetched on its own cadence.
 */
export const GetAdvertiserReferralsResponseSchema = z.object({
  referrals: AdvertiserReferralsSchema,
});
export type GetAdvertiserReferralsResponse = z.infer<
  typeof GetAdvertiserReferralsResponseSchema
>;
