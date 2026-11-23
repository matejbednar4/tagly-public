import {
  GetBusinessByUidParams,
  GetBusinessByUidParamsSchema,
  GetBusinessByUidResponse,
  GetBusinessByUidResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/businesses/:uid`. A single business's detail view,
 * fetched fresh on every call (no ETag layer — the client bounds staleness via
 * `useDetailQuery`'s `staleTime`). Authed (JWT).
 */
export function getBusinessByUid({
  params,
  jwt,
  signal,
  headers,
}: {
  params: GetBusinessByUidParams;
  jwt: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}): ApiResponse<GetBusinessByUidResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/businesses/:uid",
    params,
    jwt,
    signal,
    headers,
    schemas: {
      params: GetBusinessByUidParamsSchema,
      response: GetBusinessByUidResponseSchema,
    },
  });
}
