import { z } from "zod";
import { BusinessPublicPreviewSchema } from "../../../../dtos/v2/customerApp/businesses/businessPublicPreview";

/** `GET /v2/customers/businesses/search` — free-text business name search (global). */
export const GetBusinessesFromSearchQuerySchema = z.object({
  q: z.string().min(1),
  currentLat: z.coerce.number().gte(-90).lte(90).optional(),
  currentLon: z.coerce.number().gte(-180).lte(180).optional(),
});
export type GetBusinessesFromSearchQuery = z.infer<
  typeof GetBusinessesFromSearchQuerySchema
>;

export const GetBusinessesFromSearchResponseSchema = z.object({
  message: z.string(),
  businesses: z.array(BusinessPublicPreviewSchema).max(8),
});
export type GetBusinessesFromSearchResponse = z.infer<
  typeof GetBusinessesFromSearchResponseSchema
>;
