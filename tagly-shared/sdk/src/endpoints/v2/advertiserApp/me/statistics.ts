import {
  GetAdvertiserStatisticsResponse,
  GetAdvertiserStatisticsResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me/statistics`. The advertiser's lifetime
 * statistics (over APPROVED shares). Authed (JWT). Pure read.
 */
export function getStatistics({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetAdvertiserStatisticsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me/statistics",
    jwt,
    schemas: {
      response: GetAdvertiserStatisticsResponseSchema,
    },
  });
}
