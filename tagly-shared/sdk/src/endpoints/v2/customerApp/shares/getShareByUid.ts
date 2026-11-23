import {
  GetShareByUidParams,
  GetShareByUidParamsSchema,
  GetShareByUidResponse,
  GetShareByUidResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/shares/:uid`. A single share's detail view (the
 * customer's own share), fetched fresh on every call (no ETag layer — the
 * client bounds staleness via `useDetailQuery`'s `staleTime`). Authed (JWT).
 */
export function getShareByUid({
  params,
  jwt,
  signal,
  headers,
}: {
  params: GetShareByUidParams;
  jwt: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}): ApiResponse<GetShareByUidResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/shares/:uid",
    params,
    jwt,
    signal,
    headers,
    schemas: {
      params: GetShareByUidParamsSchema,
      response: GetShareByUidResponseSchema,
    },
  });
}
