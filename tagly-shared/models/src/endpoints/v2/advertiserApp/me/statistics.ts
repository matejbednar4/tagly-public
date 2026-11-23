import { z } from "zod";
import { AdvertiserStatisticsSchema } from "../../../../dtos/v2/advertiserApp/me/advertiserStatistics";

/**
 * `GET /v2/advertisers/me/statistics` — the advertiser's lifetime statistics
 * (over APPROVED shares). Authed (JWT); pure read. Split out of `/me` so it can
 * be fetched/cached on its own cadence, mirroring the customer's `me/statistics`.
 */
export const GetAdvertiserStatisticsResponseSchema = z.object({
  statistics: AdvertiserStatisticsSchema,
});
export type GetAdvertiserStatisticsResponse = z.infer<
  typeof GetAdvertiserStatisticsResponseSchema
>;
