import { z } from "zod";
import { CustomerMeSchema } from "../../../../dtos/v2/customerApp/me/customerMe";

/**
 * `GET /v2/customers/me` — fetch the logged-in customer's lean core profile.
 * Authed (JWT); takes no body/query/params. Pure read — app-open writes live in
 * the separate on-app-open endpoint, and the heavier slices (statistics,
 * referrals, shares, ledger, withdrawals) are their own cached endpoints.
 */
export const GetMeResponseSchema = z.object({
  customer: CustomerMeSchema,
});
export type GetMeResponse = z.infer<typeof GetMeResponseSchema>;
