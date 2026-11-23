import { z } from "zod";
import { AdminCustomerSchema } from "../../../../dtos/v2/adminApp/customers/adminCustomer";
import { AdminAdvertiserSchema } from "../../../../dtos/v2/adminApp/advertisers/adminAdvertiser";
import { AdminBusinessSchema } from "../../../../dtos/v2/adminApp/businesses/adminBusiness";
import { AdminShareSchema } from "../../../../dtos/v2/adminApp/shares/adminShare";

/** `GET /v2/admin/search` — fuzzy ILIKE across all entity types, ≤10 each. */
export const AdminSearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
});
export type AdminSearchQuery = z.infer<typeof AdminSearchQuerySchema>;

export const AdminSearchResponseSchema = z.object({
  message: z.string(),
  customers: z.array(AdminCustomerSchema),
  advertisers: z.array(AdminAdvertiserSchema),
  locals: z.array(AdminBusinessSchema),
  shares: z.array(AdminShareSchema),
});
export type AdminSearchResponse = z.infer<typeof AdminSearchResponseSchema>;
