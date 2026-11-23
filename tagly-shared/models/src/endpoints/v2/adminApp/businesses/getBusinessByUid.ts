import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../../core/uids";
import { AdminBusinessSchema } from "../../../../dtos/v2/adminApp/businesses/adminBusiness";

/** `GET /v2/admin/businesses/:uid` — one business, full admin view. */
export const AdminBusinessUidParamsSchema = z.object({
  uid: LocalSubaccountUidSchema,
});
export type AdminBusinessUidParams = z.infer<
  typeof AdminBusinessUidParamsSchema
>;

export const AdminGetBusinessResponseSchema = z.object({
  message: z.string(),
  business: AdminBusinessSchema,
});
export type AdminGetBusinessResponse = z.infer<
  typeof AdminGetBusinessResponseSchema
>;
