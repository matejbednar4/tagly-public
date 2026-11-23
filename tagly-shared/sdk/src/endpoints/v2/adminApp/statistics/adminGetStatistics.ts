import {
  AdminGetStatisticsResponse,
  AdminGetStatisticsResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/statistics`. The platform aggregate dashboard (revenue,
 * users, businesses, shares, financials, geographic, instagram, notifications).
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetStatistics({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminGetStatisticsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/statistics",
    jwt,
    schemas: {
      response: AdminGetStatisticsResponseSchema,
    },
  });
}
