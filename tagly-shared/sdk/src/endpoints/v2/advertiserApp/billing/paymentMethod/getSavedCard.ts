import {
  GetSavedCardResponse,
  GetSavedCardResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me/billing/payment-method`. The account's saved
 * off-session card (shared by PAYG + monthly budget), live from Stripe.
 * Authed (JWT).
 */
export function getSavedCard({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetSavedCardResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me/billing/payment-method",
    jwt,
    schemas: { response: GetSavedCardResponseSchema },
  });
}
