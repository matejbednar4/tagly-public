import { z } from "zod";
import { BusinessPublicPreviewSchema } from "../../../../dtos/v2/customerApp/businesses/businessPublicPreview";

/** `GET /v2/customers/businesses/in-region` — businesses whose pin is inside the SW/NE box. */
export const GetBusinessesInRegionQuerySchema = z.object({
  SWlat: z.coerce.number().gte(-90).lte(90),
  SWlon: z.coerce.number().gte(-180).lte(180),
  NElat: z.coerce.number().gte(-90).lte(90),
  NElon: z.coerce.number().gte(-180).lte(180),
  /**
   * Estimated story views for customers without Instagram. Accepted now for
   * forward-compat; ignored until the reward-estimate backend lands.
   */
});
export type GetBusinessesInRegionQuery = z.infer<
  typeof GetBusinessesInRegionQuerySchema
>;

export const GetBusinessesInRegionResponseSchema = z.object({
  message: z.string(),
  businesses: z.array(BusinessPublicPreviewSchema).max(75),
  /** True when the result was truncated to the server-side limit. Tiles should not be cached. */
  isCapped: z.boolean(),
});
export type GetBusinessesInRegionResponse = z.infer<
  typeof GetBusinessesInRegionResponseSchema
>;
