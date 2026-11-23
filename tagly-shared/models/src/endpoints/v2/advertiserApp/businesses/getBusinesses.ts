import { z } from "zod";
import { BusinessOwnerPreviewSchema } from "../../../../dtos/v2/advertiserApp/businesses/businessOwnerPreview";

/**
 * `GET /v2/advertisers/me/businesses` — the advertiser's own business pages
 * (non-deleted local subaccounts), newest first, as lean owner-facing cards.
 * Unpaginated: an advertiser has a handful of pages at most.
 */
export const GetBusinessesResponseSchema = z.object({
  businesses: z.array(BusinessOwnerPreviewSchema),
});
export type GetBusinessesResponse = z.infer<typeof GetBusinessesResponseSchema>;
