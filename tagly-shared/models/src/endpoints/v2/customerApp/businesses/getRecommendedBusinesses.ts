import { z } from "zod";
import { BusinessPublicPreviewSchema } from "../../../../dtos/v2/customerApp/businesses/businessPublicPreview";

/**
 * `GET /v2/customers/businesses/recommended` — the "Recommended for you" Discover
 * shelf. Accessible businesses whose vertical matches the customer's declared
 * interests and the verticals they've shared into, anchored near the customer's
 * location, hydrated with reward estimates. A customer with no interests and no
 * shares (cold start) gets the nearest accessible businesses instead.
 *
 * `currentLat` / `currentLon` are the proximity anchor (the device location).
 * snapshot (mirrors the map), so the shelf still shows estimates pre-snapshot.
 */
export const GetRecommendedBusinessesQuerySchema = z.object({
  currentLat: z.coerce.number().gte(-90).lte(90).optional(),
  currentLon: z.coerce.number().gte(-180).lte(180).optional(),
});
export type GetRecommendedBusinessesQuery = z.infer<
  typeof GetRecommendedBusinessesQuerySchema
>;

export const GetRecommendedBusinessesResponseSchema = z.object({
  message: z.string(),
  // Mirrors the backend DISCOVER.SHELF_LIMIT.
  businesses: z.array(BusinessPublicPreviewSchema).max(12),
});
export type GetRecommendedBusinessesResponse = z.infer<
  typeof GetRecommendedBusinessesResponseSchema
>;
