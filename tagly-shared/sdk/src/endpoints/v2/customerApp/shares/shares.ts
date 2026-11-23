import {
  GetMySharesBody,
  GetMySharesBodySchema,
  GetMySharesResponse,
  GetMySharesResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/shares`. The logged-in customer's own shares,
 * offset-paginated (newest first by default). POST + body so it plugs into the
 * shared `makeOffsetFetcher`/`PaginatedList` convention (like `getAllBusinesses`).
 * Authed (JWT).
 */
export function getMyShares({
  body,
  jwt,
}: {
  body: GetMySharesBody;
  jwt: string;
}): ApiResponse<GetMySharesResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/shares",
    body,
    jwt,
    schemas: {
      body: GetMySharesBodySchema,
      response: GetMySharesResponseSchema,
    },
  });
}
