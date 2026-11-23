import { z } from "zod";
import { AdvertiserUidSchema } from "../../../../core/uids";
import { AdminAdvertiserSchema } from "../../../../dtos/v2/adminApp/advertisers/adminAdvertiser";

/** `GET /v2/admin/advertisers/:uid` — one advertiser, full admin view. */
export const AdminAdvertiserUidParamsSchema = z.object({
  uid: AdvertiserUidSchema,
});
export type AdminAdvertiserUidParams = z.infer<
  typeof AdminAdvertiserUidParamsSchema
>;

export const AdminGetAdvertiserResponseSchema = z.object({
  message: z.string(),
  advertiser: AdminAdvertiserSchema,
});
export type AdminGetAdvertiserResponse = z.infer<
  typeof AdminGetAdvertiserResponseSchema
>;
