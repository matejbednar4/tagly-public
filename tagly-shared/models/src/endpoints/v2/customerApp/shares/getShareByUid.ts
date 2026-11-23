import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";
import { CustomerShareDetailsSchema } from "../../../../dtos/v2/customerApp/shares/customerShareDetails";

/**
 * `GET /v2/customers/shares/:uid` — a single share's detail view (the logged-in
 * customer's own share; IDOR-protected).
 */
export const GetShareByUidParamsSchema = z.object({
  uid: ShareUidSchema,
});
export type GetShareByUidParams = z.infer<typeof GetShareByUidParamsSchema>;

export const GetShareByUidResponseSchema = z.object({
  message: z.string(),
  share: CustomerShareDetailsSchema,
});
export type GetShareByUidResponse = z.infer<typeof GetShareByUidResponseSchema>;
