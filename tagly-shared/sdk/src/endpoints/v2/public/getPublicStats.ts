import {
  GetPublicStatsResponse,
  GetPublicStatsResponseSchema,
} from "@tagly/models/v2/crossApp";
import { ApiResponse, request } from "../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/public/stats`. Public marketing counters (customer count +
 * visible business-page count) for landing surfaces. Unauthenticated and
 * IP-rate-limited; consumers should cache the result (the web landings use
 * Next's data cache) — the backend itself computes it fresh per request.
 */
export function getPublicStats(): ApiResponse<
  GetPublicStatsResponse | ApiError
> {
  return request({
    method: "GET",
    path: "/v2/public/stats",
    schemas: {
      response: GetPublicStatsResponseSchema,
    },
  });
}
