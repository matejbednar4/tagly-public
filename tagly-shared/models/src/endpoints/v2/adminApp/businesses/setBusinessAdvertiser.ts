import { z } from "zod";
import { AdvertiserUidSchema } from "../../../../core/uids";
import { AdminBusinessSchema } from "../../../../dtos/v2/adminApp/businesses/adminBusiness";

/**
 * `PATCH /v2/admin/businesses/:uid/advertiser` — the onboarding-assist
 * handover: assign an admin-created UNOWNED page to an advertiser. Hard-gated
 * server-side: the page must be ACTIVE, unowned, NEVER subsidized (no
 * SubsidizationPeriod rows, open or closed) and NEVER have had any shares;
 * the advertiser's locale must match the page's country. No share/money state
 * is moved — this is not a general re-ownership tool. Params reuse
 * `AdminBusinessUidParamsSchema`.
 */
export const AdminSetBusinessAdvertiserBodySchema = z.object({
  advertiserUid: AdvertiserUidSchema,
});
export type AdminSetBusinessAdvertiserBody = z.infer<
  typeof AdminSetBusinessAdvertiserBodySchema
>;

export const AdminSetBusinessAdvertiserResponseSchema = z.object({
  message: z.string(),
  business: AdminBusinessSchema,
});
export type AdminSetBusinessAdvertiserResponse = z.infer<
  typeof AdminSetBusinessAdvertiserResponseSchema
>;
