import {
  GetConnectStatusQuerySchema,
  GetConnectStatusResponse,
  GetConnectStatusResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/me/cash-out/connect-status`. Returns `{ hasAccount,
 * payoutsEnabledAt }`. By default reads the DB (kept fresh by the account.updated
 * webhook) — cheap. Pass `sync: true` to force a live Stripe reconcile (used right
 * after onboarding so completion is caught even if the webhook lags). Authed (JWT).
 */
export function getConnectStatus({
  jwt,
  sync,
}: {
  jwt: string;
  sync?: boolean;
}): ApiResponse<GetConnectStatusResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/me/cash-out/connect-status",
    query: sync ? { sync: true } : undefined,
    jwt,
    schemas: {
      query: GetConnectStatusQuerySchema,
      response: GetConnectStatusResponseSchema,
    },
  });
}
