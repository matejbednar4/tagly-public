import { z } from "zod";
import {
  PaginationReqBase,
  PaginationResBase,
} from "../../../../core/pagination";
import { VisitedBusinessPreviewSchema } from "../../../../dtos/v2/customerApp/businesses/visitedBusinessPreview";

/**
 * `POST /v2/customers/businesses/visited` — businesses the logged-in customer has
 * shared at ("visited"), most-recently-visited first. Offset-paginated. POST +
 * body so it plugs into the codebase's paginated-list convention
 * (`makeOffsetFetcher`/`PaginatedList`), like `getAllBusinesses`. No sort/filter
 * yet — the order is fixed to most recent visit first.
 *
 */
export const GetVisitedBusinessesBodySchema = PaginationReqBase.extend({});
export type GetVisitedBusinessesBody = z.infer<
  typeof GetVisitedBusinessesBodySchema
>;

export const GetVisitedBusinessesResponseSchema = PaginationResBase.extend({
  message: z.string(),
  businesses: z.array(VisitedBusinessPreviewSchema),
});
export type GetVisitedBusinessesResponse = z.infer<
  typeof GetVisitedBusinessesResponseSchema
>;
