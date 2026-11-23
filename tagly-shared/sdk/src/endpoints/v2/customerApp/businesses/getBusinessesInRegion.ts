import {
  GetBusinessesInRegionQuery,
  GetBusinessesInRegionQuerySchema,
  GetBusinessesInRegionResponse,
  GetBusinessesInRegionResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/businesses/in-region`. Businesses (locals) whose pin
 * falls inside the given SW/NE bounding box, for the map. Authed (JWT).
 */
export function getBusinessesInRegion({
  query,
  jwt,
}: {
  query: GetBusinessesInRegionQuery;
  jwt: string;
}): ApiResponse<GetBusinessesInRegionResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/businesses/in-region",
    query,
    jwt,
    schemas: {
      query: GetBusinessesInRegionQuerySchema,
      response: GetBusinessesInRegionResponseSchema,
    },
  });
}
