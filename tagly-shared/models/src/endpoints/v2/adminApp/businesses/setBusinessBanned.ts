import { z } from "zod";
import { AdminBusinessSchema } from "../../../../dtos/v2/adminApp/businesses/adminBusiness";

/**
 * `PATCH /v2/admin/businesses/:uid/banned` — ban (`true`, ACTIVE→BANNED) or
 * unban (`false`, BANNED→ACTIVE) a business page. Atomic status CAS; a BANNED
 * page is customer-hidden immediately while the owner still sees it
 * (view-only). In-flight shares settle normally. Params reuse
 * `AdminBusinessUidParamsSchema`.
 */
export const AdminSetBusinessBannedBodySchema = z.object({
  banned: z.boolean(),
});
export type AdminSetBusinessBannedBody = z.infer<
  typeof AdminSetBusinessBannedBodySchema
>;

export const AdminSetBusinessBannedResponseSchema = z.object({
  message: z.string(),
  business: AdminBusinessSchema,
});
export type AdminSetBusinessBannedResponse = z.infer<
  typeof AdminSetBusinessBannedResponseSchema
>;
