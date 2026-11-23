import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../../core/uids";
import { BusinessOwnerDetailsSchema } from "../../../../dtos/v2/advertiserApp/businesses/businessOwnerDetails";

/**
 * `GET /v2/advertisers/me/businesses/:uid` — one of the advertiser's own
 * business pages in full (the owner-facing detail screen). Authed; ownership is
 * the query filter.
 */
export const GetBusinessByUidParamsSchema = z.object({
  uid: LocalSubaccountUidSchema,
});
export type GetBusinessByUidParams = z.infer<
  typeof GetBusinessByUidParamsSchema
>;

export const GetBusinessByUidResponseSchema = z.object({
  business: BusinessOwnerDetailsSchema,
});
export type GetBusinessByUidResponse = z.infer<
  typeof GetBusinessByUidResponseSchema
>;
