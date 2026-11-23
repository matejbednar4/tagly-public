import {
  GetWithdrawalStatusQuery,
  GetWithdrawalStatusQuerySchema,
  GetWithdrawalStatusResponse,
  GetWithdrawalStatusResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/me/cash-out/withdrawal-status?withdrawalUid=…`. The
 * single-withdrawal "did my cash-out work?" poll, returning the display state
 * (processing / delayed / paid out / failed / reversed). Authed (JWT).
 */
export function getWithdrawalStatus({
  query,
  jwt,
}: {
  query: GetWithdrawalStatusQuery;
  jwt: string;
}): ApiResponse<GetWithdrawalStatusResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/me/cash-out/withdrawal-status",
    query,
    jwt,
    schemas: {
      query: GetWithdrawalStatusQuerySchema,
      response: GetWithdrawalStatusResponseSchema,
    },
  });
}
