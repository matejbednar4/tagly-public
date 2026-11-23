import { z } from "zod";
import { AdminCustomerSchema } from "../../../../dtos/v2/adminApp/customers/adminCustomer";
import { AdminAdvertiserSchema } from "../../../../dtos/v2/adminApp/advertisers/adminAdvertiser";
import { AdminBusinessSchema } from "../../../../dtos/v2/adminApp/businesses/adminBusiness";
import { AdminShareSchema } from "../../../../dtos/v2/adminApp/shares/adminShare";

/** `GET /v2/admin/entities` — one entity type per call, 10 per page. */
export const AdminListEntityTypeSchema = z.enum([
  "customer",
  "advertiser",
  "local",
  "share",
]);
export type AdminListEntityType = z.infer<typeof AdminListEntityTypeSchema>;

export const AdminListSortSchema = z.enum([
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
]);
export type AdminListSort = z.infer<typeof AdminListSortSchema>;

export const AdminListEntitiesQuerySchema = z.object({
  type: AdminListEntityTypeSchema,
  sort: AdminListSortSchema.default("newest"),
  page: z.coerce.number().int().positive().default(1),
});
export type AdminListEntitiesQuery = z.infer<
  typeof AdminListEntitiesQuerySchema
>;

export const AdminListEntitiesResponseSchema = z.object({
  message: z.string(),
  customers: z.array(AdminCustomerSchema),
  advertisers: z.array(AdminAdvertiserSchema),
  locals: z.array(AdminBusinessSchema),
  shares: z.array(AdminShareSchema),
  total: z.number(),
  page: z.number(),
  hasMore: z.boolean(),
});
export type AdminListEntitiesResponse = z.infer<
  typeof AdminListEntitiesResponseSchema
>;
