import { z } from "zod";
import {
  PaginationReqBase,
  PaginationResBase,
} from "../../../../core/pagination";
import { AdvertiserSharePreviewSchema } from "../../../../dtos/v2/advertiserApp/shares/advertiserSharePreview";

/**
 * `POST /v2/advertisers/shares` — the logged-in advertiser's own shares (across
 * all their businesses), offset-paginated, newest first by default. Authed.
 *
 * POST + body (not GET) to match the codebase's paginated-list convention
 * (`makeOffsetFetcher`/`PaginatedList` send `{ offset, ... }` as a JSON body),
 * the same shape as the customer's `getMyShares`.
 */
export const AdvertiserShareListSortSchema = z.enum([
  "newest",
  "oldest",
  "highest_price",
  "lowest_price",
]);
export type AdvertiserShareListSort = z.infer<
  typeof AdvertiserShareListSortSchema
>;

export const GetAdvertiserSharesBodySchema = PaginationReqBase.extend({
  sortBy: AdvertiserShareListSortSchema.default("newest"),
});
export type GetAdvertiserSharesBody = z.infer<
  typeof GetAdvertiserSharesBodySchema
>;

export const GetAdvertiserSharesResponseSchema = PaginationResBase.extend({
  message: z.string(),
  shares: z.array(AdvertiserSharePreviewSchema),
});
export type GetAdvertiserSharesResponse = z.infer<
  typeof GetAdvertiserSharesResponseSchema
>;
