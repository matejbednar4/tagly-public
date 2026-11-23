import { z } from "zod";
import { CustomerReferralsSchema } from "../../../../dtos/v2/customerApp/me/customerReferrals";

/**
 * `GET /v2/customers/me/referrals` — the customer's referral code, status,
 * referrer, referred counts, and lifetime referral earnings. Authed (JWT); pure
 * read. Split out of `/me` so it can be cached on its own cadence.
 */
export const GetReferralsResponseSchema = z.object({
  referrals: CustomerReferralsSchema,
});
export type GetReferralsResponse = z.infer<typeof GetReferralsResponseSchema>;
