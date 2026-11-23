import {
  AdminGetStripeBalanceResponse,
  AdminGetStripeBalanceResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/balance/stripe`. Live Stripe platform balance split into
 * assigned/unassigned buckets (advertisers, customers, subsidized-share locks).
 * Hits the Stripe API on every call — fetch on demand, not on an interval.
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetStripeBalance({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminGetStripeBalanceResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/balance/stripe",
    jwt,
    schemas: {
      response: AdminGetStripeBalanceResponseSchema,
    },
  });
}
