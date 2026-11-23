import { z } from "zod";
import {
  PaginationReqBase,
  PaginationResBase,
} from "../../../../core/pagination";
import { CustomerSharePreviewSchema } from "../../../../dtos/v2/customerApp/shares/customerSharePreview";

/**
 * `POST /v2/customers/shares` — the logged-in customer's own shares. Offset-
 * paginated (page index, like the other lists), newest first by default. Authed.
 *
 * POST + body (not GET) so it matches the codebase's paginated-list convention
 * (`makeOffsetFetcher`/`PaginatedList` send `{ offset, ... }` as a JSON body),
 * the same shape as `getAllBusinesses`.
 */
export const ShareListSortSchema = z.enum([
  "newest",
  "oldest",
  "highest_reward",
  "lowest_reward",
]);
export type ShareListSort = z.infer<typeof ShareListSortSchema>;

export const GetMySharesBodySchema = PaginationReqBase.extend({
  sortBy: ShareListSortSchema.default("newest"),
});
export type GetMySharesBody = z.infer<typeof GetMySharesBodySchema>;

export const GetMySharesResponseSchema = PaginationResBase.extend({
  message: z.string(),
  shares: z.array(CustomerSharePreviewSchema),
});
export type GetMySharesResponse = z.infer<typeof GetMySharesResponseSchema>;
