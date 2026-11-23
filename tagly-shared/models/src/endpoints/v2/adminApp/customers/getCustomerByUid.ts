import { z } from "zod";
import { CustomerUidSchema } from "../../../../core/uids";
import { AdminCustomerSchema } from "../../../../dtos/v2/adminApp/customers/adminCustomer";

/** `GET /v2/admin/customers/:uid` — one customer, full admin view. */
export const AdminCustomerUidParamsSchema = z.object({
  uid: CustomerUidSchema,
});
export type AdminCustomerUidParams = z.infer<
  typeof AdminCustomerUidParamsSchema
>;

export const AdminGetCustomerResponseSchema = z.object({
  message: z.string(),
  customer: AdminCustomerSchema,
});
export type AdminGetCustomerResponse = z.infer<
  typeof AdminGetCustomerResponseSchema
>;
