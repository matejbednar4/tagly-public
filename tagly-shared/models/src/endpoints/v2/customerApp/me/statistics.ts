import { z } from "zod";
import { CustomerStatisticsSchema } from "../../../../dtos/v2/customerApp/me/customerStatistics";

/**
 * `GET /v2/customers/me/statistics` — the customer's lifetime sharing
 * statistics. Authed (JWT); pure read. Split out of `/me` so it can be cached
 * on its own cadence.
 */
export const GetStatisticsResponseSchema = z.object({
  statistics: CustomerStatisticsSchema,
});
export type GetStatisticsResponse = z.infer<typeof GetStatisticsResponseSchema>;
