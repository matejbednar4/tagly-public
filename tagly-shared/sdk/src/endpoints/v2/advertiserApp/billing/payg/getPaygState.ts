import {
  GetPaygStateResponse,
  GetPaygStateResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me/billing/payg`. The full pay-as-you-go state for
 * the manage sheet: the linked card (live from Stripe), active flag, why the
 * last period closed, monthly cap, and this month's PAYG spend. Authed (JWT).
 */
export function getPaygState({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetPaygStateResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me/billing/payg",
    jwt,
    schemas: { response: GetPaygStateResponseSchema },
  });
}
