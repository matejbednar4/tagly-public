import { z } from "zod";

/**
 * `DELETE /v2/advertisers/me/businesses/:uid` — remove one of the advertiser's
 * own business pages. Two-stage removal: the page is marked DELETED immediately
 * (hidden from customers and the advertiser everywhere), and a cleanup worker
 * hard-purges the row + media once no in-flight shares remain. In-flight
 * shares are honored — customers who already posted still get paid.
 *
 * Params reuse `GetBusinessByUidParamsSchema`. No request body.
 */
export const DeleteBusinessResponseSchema = z.object({
  /** Always true — the page is gone from every surface on success. */
  deleted: z.literal(true),
});
export type DeleteBusinessResponse = z.infer<
  typeof DeleteBusinessResponseSchema
>;
