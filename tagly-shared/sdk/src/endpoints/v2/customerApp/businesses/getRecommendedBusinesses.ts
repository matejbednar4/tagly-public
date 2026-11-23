import {
  GetRecommendedBusinessesQuery,
  GetRecommendedBusinessesQuerySchema,
  GetRecommendedBusinessesResponse,
  GetRecommendedBusinessesResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/businesses/recommended`. The "Recommended for you"
 * Discover shelf: accessible businesses matching the customer's interests +
 * shared verticals, anchored near their location, with reward estimates. Falls
 * back to nearest businesses for a customer with no taste signal. Authed (JWT).
 */
export function getRecommendedBusinesses({
  query,
  jwt,
}: {
  query: GetRecommendedBusinessesQuery;
  jwt: string;
}): ApiResponse<GetRecommendedBusinessesResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/businesses/recommended",
    query,
    jwt,
    schemas: {
      query: GetRecommendedBusinessesQuerySchema,
      response: GetRecommendedBusinessesResponseSchema,
    },
  });
}
