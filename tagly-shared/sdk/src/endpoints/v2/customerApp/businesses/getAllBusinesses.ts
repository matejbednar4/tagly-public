import {
  GetAllBusinessesBody,
  GetAllBusinessesBodySchema,
  GetAllBusinessesResponse,
  GetAllBusinessesResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/businesses/all`. The paginated "browse all
 * businesses" directory: accessible businesses in the customer's market, sorted
 * by name or distance, optionally filtered to verticals, with reward estimates.
 * POST + body so the `verticalSlugs` array + pagination ride in JSON. Authed (JWT).
 */
export function getAllBusinesses({
  body,
  jwt,
}: {
  body: GetAllBusinessesBody;
  jwt: string;
}): ApiResponse<GetAllBusinessesResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/businesses/all",
    body,
    jwt,
    schemas: {
      body: GetAllBusinessesBodySchema,
      response: GetAllBusinessesResponseSchema,
    },
  });
}
