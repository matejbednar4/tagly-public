import {
  GetMostPayingBusinessesQuery,
  GetMostPayingBusinessesQuerySchema,
  GetMostPayingBusinessesResponse,
  GetMostPayingBusinessesResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/businesses/top-earning`. The "Earn the most" Discover
 * shelf: highest-paying accessible businesses near the customer's top Instagram
 * audience locations, biased toward their interests. Returns an empty list when
 * the customer has no snapshot yet (the client hides the shelf). Authed (JWT).
 */
export function getMostPayingBusinesses({
  query,
  jwt,
}: {
  query: GetMostPayingBusinessesQuery;
  jwt: string;
}): ApiResponse<GetMostPayingBusinessesResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/businesses/top-earning",
    query,
    jwt,
    schemas: {
      query: GetMostPayingBusinessesQuerySchema,
      response: GetMostPayingBusinessesResponseSchema,
    },
  });
}
