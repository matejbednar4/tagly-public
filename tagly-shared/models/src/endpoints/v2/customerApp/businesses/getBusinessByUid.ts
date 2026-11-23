import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../../core/uids";
import { BusinessPublicDetailsSchema } from "../../../../dtos/v2/customerApp/businesses/businessPublicDetails";

/**
 * `GET /v2/customers/businesses/:uid` — a single business's detail view.
 */
export const GetBusinessByUidParamsSchema = z.object({
  uid: LocalSubaccountUidSchema,
});
export type GetBusinessByUidParams = z.infer<
  typeof GetBusinessByUidParamsSchema
>;

export const GetBusinessByUidResponseSchema = z.object({
  message: z.string(),
  business: BusinessPublicDetailsSchema,
});
export type GetBusinessByUidResponse = z.infer<
  typeof GetBusinessByUidResponseSchema
>;
