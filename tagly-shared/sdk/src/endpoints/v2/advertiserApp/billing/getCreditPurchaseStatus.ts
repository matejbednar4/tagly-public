import {
  GetCreditPurchaseStatusParams,
  GetCreditPurchaseStatusParamsSchema,
  GetCreditPurchaseStatusResponse,
  GetCreditPurchaseStatusResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me/billing/credit-purchases/:uid`. Read the
 * current status of one of the advertiser's own credit purchases (PENDING /
 * COMPLETED / FAILED). Polled after the PaymentSheet succeeds to verify the
 * webhook booked the credits. Authed (JWT).
 */
export function getCreditPurchaseStatus({
  params,
  jwt,
}: {
  params: GetCreditPurchaseStatusParams;
  jwt: string;
}): ApiResponse<GetCreditPurchaseStatusResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me/billing/credit-purchases/:uid",
    params,
    jwt,
    schemas: {
      params: GetCreditPurchaseStatusParamsSchema,
      response: GetCreditPurchaseStatusResponseSchema,
    },
  });
}
