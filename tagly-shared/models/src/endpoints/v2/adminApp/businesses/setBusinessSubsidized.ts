import { z } from "zod";
import { AdminBusinessSchema } from "../../../../dtos/v2/adminApp/businesses/adminBusiness";

/**
 * `PATCH /v2/admin/businesses/:uid/subsidized` — open (`true`) or close
 * (`false`) the business's SubsidizationPeriod. Only an ACTIVE, UNOWNED page
 * can be subsidized (owned XOR subsidized); closing never affects in-flight
 * shares (they settle per their immutable `fundingModeAtCreation` stamp).
 * Params reuse `AdminBusinessUidParamsSchema`.
 */
export const AdminSetBusinessSubsidizedBodySchema = z.object({
  isSubsidized: z.boolean(),
});
export type AdminSetBusinessSubsidizedBody = z.infer<
  typeof AdminSetBusinessSubsidizedBodySchema
>;

export const AdminSetBusinessSubsidizedResponseSchema = z.object({
  message: z.string(),
  business: AdminBusinessSchema,
});
export type AdminSetBusinessSubsidizedResponse = z.infer<
  typeof AdminSetBusinessSubsidizedResponseSchema
>;
