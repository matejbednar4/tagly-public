import { z } from "zod";
import { BusinessPublicPreviewSchema } from "../../../../dtos/v2/customerApp/businesses/businessPublicPreview";

/**
 * `GET /v2/customers/businesses/nearest` — the "Near you" Discover shelf. Pure
 * proximity: the accessible businesses closest to the device location, with
 * reward estimates. No market filter (it's spatial), no taste/vertical filter
 * (that's the Recommended shelf) and no audience-location ranking (that's
 * Earn-the-most) — just what's closest.
 *
 * `currentLat` / `currentLon` are the device location and are **required** —
 * "near you" is meaningless without the user's actual position, and we
 * deliberately do NOT fall back to audience locations. The client only calls this
 * (and only shows the shelf) when location permission was granted.
 * snapshot.
 */
export const GetNearestBusinessesQuerySchema = z.object({
  currentLat: z.coerce.number().gte(-90).lte(90),
  currentLon: z.coerce.number().gte(-180).lte(180),
});
export type GetNearestBusinessesQuery = z.infer<
  typeof GetNearestBusinessesQuerySchema
>;

export const GetNearestBusinessesResponseSchema = z.object({
  message: z.string(),
  // Mirrors the backend DISCOVER.SHELF_LIMIT.
  businesses: z.array(BusinessPublicPreviewSchema).max(12),
});
export type GetNearestBusinessesResponse = z.infer<
  typeof GetNearestBusinessesResponseSchema
>;
