import { z } from "zod";
import { AdminCustomerSchema } from "../../../../dtos/v2/adminApp/customers/adminCustomer";

/**
 * `PATCH /v2/admin/customers/:uid/multiplier` — set the customer's rating
 * multiplier to an ABSOLUTE value in basis points (10000 = 1.0x). The server
 * rejects values outside the v2 rating-algorithm bounds
 * (`CUSTOMER_RATING_MULTIPLIER.minBps..maxBps` — backend-owned, so the wire
 * only requires a positive int here). Params reuse
 * `AdminCustomerUidParamsSchema`.
 */
export const AdminSetCustomerMultiplierBodySchema = z.object({
  /** Absolute multiplier in bps (10000 = 1.0x); server-clamped to algo bounds. */
  multiplierBps: z.number().int().positive(),
});
export type AdminSetCustomerMultiplierBody = z.infer<
  typeof AdminSetCustomerMultiplierBodySchema
>;

export const AdminSetCustomerMultiplierResponseSchema = z.object({
  message: z.string(),
  customer: AdminCustomerSchema,
});
export type AdminSetCustomerMultiplierResponse = z.infer<
  typeof AdminSetCustomerMultiplierResponseSchema
>;
