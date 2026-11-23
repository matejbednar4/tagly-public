import {
  AdminSearchQuery,
  AdminSearchQuerySchema,
  AdminSearchResponse,
  AdminSearchResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/search`. Fuzzy ILIKE across customers / advertisers /
 * locals / shares (≤10 each), each fully hydrated into its admin detail DTO.
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminSearch({
  query,
  jwt,
}: {
  query: AdminSearchQuery;
  jwt: string;
}): ApiResponse<AdminSearchResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/search",
    query,
    jwt,
    schemas: {
      query: AdminSearchQuerySchema,
      response: AdminSearchResponseSchema,
    },
  });
}
