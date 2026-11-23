import {
  GetNearestBusinessesQuery,
  GetNearestBusinessesQuerySchema,
  GetNearestBusinessesResponse,
  GetNearestBusinessesResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/businesses/nearest`. The "Near you" Discover shelf:
 * accessible businesses closest to the device location (or the customer's top
 * audience location when GPS isn't shared), with reward estimates. Authed (JWT).
 */
export function getNearestBusinesses({
  query,
  jwt,
}: {
  query: GetNearestBusinessesQuery;
  jwt: string;
}): ApiResponse<GetNearestBusinessesResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/businesses/nearest",
    query,
    jwt,
    schemas: {
      query: GetNearestBusinessesQuerySchema,
      response: GetNearestBusinessesResponseSchema,
    },
  });
}
