import {
  GetStatisticsResponse,
  GetStatisticsResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/me/statistics`. The customer's lifetime sharing
 * statistics. Authed (JWT). Pure read.
 */
export function getStatistics({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetStatisticsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/me/statistics",
    jwt,
    schemas: {
      response: GetStatisticsResponseSchema,
    },
  });
}
