import {
  CreateExpressDashboardLinkResponse,
  CreateExpressDashboardLinkResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/cash-out/dashboard-link`. One-time login link to
 * the customer's Stripe Express Dashboard (payout history, bank details).
 * Authed (JWT).
 */
export function createExpressDashboardLink({
  jwt,
}: {
  jwt: string;
}): ApiResponse<CreateExpressDashboardLinkResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/cash-out/dashboard-link",
    jwt,
    schemas: {
      response: CreateExpressDashboardLinkResponseSchema,
    },
  });
}
