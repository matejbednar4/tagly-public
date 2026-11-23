import { z } from "zod";
import { AdminShareSchema } from "../../../../dtos/v2/adminApp/shares/adminShare";

/**
 * `GET /v2/admin/shares/from/:uid` — paginated shares belonging to one entity
 * (customer / advertiser / business), resolved from the uid prefix. 10 per page.
 * Powers the "shares from X" list reached from every entity detail screen.
 */
export const AdminSharesFromUidParamsSchema = z.object({
  // Any of a customer / advertiser / local-subaccount uid; the controller
  // resolves the parent type from the prefix.
  uid: z.string(),
});
export type AdminSharesFromUidParams = z.infer<
  typeof AdminSharesFromUidParamsSchema
>;

export const AdminSharesSortSchema = z.enum([
  "newest",
  "oldest",
  "highest_reward",
  "lowest_reward",
]);
export type AdminSharesSort = z.infer<typeof AdminSharesSortSchema>;

export const AdminSharesFromUidQuerySchema = z.object({
  sort: AdminSharesSortSchema.default("newest"),
  page: z.coerce.number().int().positive().default(1),
});
export type AdminSharesFromUidQuery = z.infer<
  typeof AdminSharesFromUidQuerySchema
>;

export const AdminSharesFromUidResponseSchema = z.object({
  message: z.string(),
  shares: z.array(AdminShareSchema),
  total: z.number(),
  page: z.number(),
  hasMore: z.boolean(),
});
export type AdminSharesFromUidResponse = z.infer<
  typeof AdminSharesFromUidResponseSchema
>;
