import { z } from "zod";
import { BusinessPublicPreviewSchema } from "../../../../dtos/v2/customerApp/businesses/businessPublicPreview";

/**
 * `GET /v2/customers/businesses/top-earning` — the "Earn the most" Discover
 * shelf. Gathers accessible businesses near the customer's top Instagram
 * audience locations (geography is the dominant reward multiplier), biased toward
 * their interests/shared verticals, prices the candidates, and returns the
 * highest-earning ones.
 *
 * Requires an Instagram snapshot — without one there are no audience locations to
 * rank by, so the response is an empty list (the client hides the shelf and shows
 * the "rewards calculating" notice via `CustomerMe.instagram.hasSnapshot`). No
 * query params: the ranking is fully derived from the customer's snapshot.
 */
export const GetMostPayingBusinessesQuerySchema = z.object({});
export type GetMostPayingBusinessesQuery = z.infer<
  typeof GetMostPayingBusinessesQuerySchema
>;

export const GetMostPayingBusinessesResponseSchema = z.object({
  message: z.string(),
  // Mirrors the backend DISCOVER.SHELF_LIMIT.
  businesses: z.array(BusinessPublicPreviewSchema).max(12),
});
export type GetMostPayingBusinessesResponse = z.infer<
  typeof GetMostPayingBusinessesResponseSchema
>;
