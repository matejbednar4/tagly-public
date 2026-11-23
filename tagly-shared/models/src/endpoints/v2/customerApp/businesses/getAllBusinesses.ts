import { z } from "zod";
import { PaginationReqBase, PaginationResBase } from "../../../../core/pagination";
import { BusinessPublicPreviewSchema } from "../../../../dtos/v2/customerApp/businesses/businessPublicPreview";

/**
 * `POST /v2/customers/businesses/all` — the paginated "browse all businesses"
 * list (the full directory behind the Discover shelves). Accessible businesses
 * (visible == shareable) in the customer's market, hydrated with reward
 * estimates. POST + body (not GET) so the multi-select `verticalSlugs` filter
 * rides in a JSON array, matching the codebase's other paginated lists.
 *
 * Sort:
 *  • `"name"`     — case-insensitive A→Z (always available; the default).
 *  • `"distance"` — nearest-first; needs `currentLat`/`currentLon`. The backend
 *    falls back to name sort if distance is requested without coordinates.
 *
 * `verticalSlugs` filters to those verticals (multi-select); omitted = all.
 */
export const BusinessListSortSchema = z.enum(["name", "distance"]);
export type BusinessListSort = z.infer<typeof BusinessListSortSchema>;

export const GetAllBusinessesBodySchema = PaginationReqBase.extend({
  sort: BusinessListSortSchema.default("name"),
  verticalSlugs: z.array(z.string().min(1)).optional(),
  currentLat: z.coerce.number().gte(-90).lte(90).optional(),
  currentLon: z.coerce.number().gte(-180).lte(180).optional(),
});
export type GetAllBusinessesBody = z.infer<typeof GetAllBusinessesBodySchema>;

export const GetAllBusinessesResponseSchema = PaginationResBase.extend({
  message: z.string(),
  businesses: z.array(BusinessPublicPreviewSchema),
});
export type GetAllBusinessesResponse = z.infer<
  typeof GetAllBusinessesResponseSchema
>;
