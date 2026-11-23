import {
  GetVisitedBusinessesBody,
  GetVisitedBusinessesBodySchema,
  GetVisitedBusinessesResponse,
  GetVisitedBusinessesResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/businesses/visited`. The businesses the logged-in
 * customer has shared at, most-recently-visited first, with per-business visit
 * count + total earned. Offset-paginated; POST + body so it plugs into the shared
 * `makeOffsetFetcher`/`PaginatedList` convention. Authed (JWT).
 */
export function getVisitedBusinesses({
  body,
  jwt,
}: {
  body: GetVisitedBusinessesBody;
  jwt: string;
}): ApiResponse<GetVisitedBusinessesResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/businesses/visited",
    body,
    jwt,
    schemas: {
      body: GetVisitedBusinessesBodySchema,
      response: GetVisitedBusinessesResponseSchema,
    },
  });
}
