import {
  GetBusinessesFromSearchQuery,
  GetBusinessesFromSearchQuerySchema,
  GetBusinessesFromSearchResponse,
  GetBusinessesFromSearchResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/businesses/search`. Free-text business (local) name
 * search for the map's search control. Authed (JWT).
 */
export function getBusinessesFromSearch({
  query,
  jwt,
}: {
  query: GetBusinessesFromSearchQuery;
  jwt: string;
}): ApiResponse<GetBusinessesFromSearchResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/businesses/search",
    query,
    jwt,
    schemas: {
      query: GetBusinessesFromSearchQuerySchema,
      response: GetBusinessesFromSearchResponseSchema,
    },
  });
}
