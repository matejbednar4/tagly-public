import { z } from "zod";
import { AdminCustomerSchema } from "../../../../dtos/v2/adminApp/customers/adminCustomer";

/**
 * `PATCH /v2/admin/customers/:uid/banned` — ban (`true`) or unban (`false`) a
 * customer. Banning also blocklists their Instagram (`BannedInstagram`) and
 * always emails them (mandatory event) with the reason; a banned customer can
 * log in but can't create shares or withdraw. In-flight shares still settle
 * (the ban is not a clawback). Params reuse `AdminCustomerUidParamsSchema`.
 */
export const AdminSetCustomerBannedBodySchema = z
  .object({
    banned: z.boolean(),
    /**
     * Reason shown to the customer in the ban email (and surfaced as their
     * `banReason`). Required when banning, ignored when unbanning.
     */
    reason: z.string().max(1000).optional(),
  })
  .refine((d) => !d.banned || (d.reason?.trim().length ?? 0) > 0, {
    message: "A reason is required when banning",
    path: ["reason"],
  });
export type AdminSetCustomerBannedBody = z.infer<
  typeof AdminSetCustomerBannedBodySchema
>;

export const AdminSetCustomerBannedResponseSchema = z.object({
  message: z.string(),
  customer: AdminCustomerSchema,
});
export type AdminSetCustomerBannedResponse = z.infer<
  typeof AdminSetCustomerBannedResponseSchema
>;
