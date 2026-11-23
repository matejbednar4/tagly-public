import {
  CreateCreditPurchaseBody,
  CreateCreditPurchaseBodySchema,
  CreateCreditPurchaseResponse,
  CreateCreditPurchaseResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/billing/credit-purchases`. Start a prepaid
 * credit top-up: creates the PENDING purchase + PaymentIntent and returns the
 * client secret (+ customer & ephemeral key) for the native PaymentSheet.
 * Crediting is webhook-driven. Authed (JWT).
 */
export function createCreditPurchase({
  jwt,
  body,
}: {
  jwt: string;
  body: CreateCreditPurchaseBody;
}): ApiResponse<CreateCreditPurchaseResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/billing/credit-purchases",
    jwt,
    body,
    schemas: {
      body: CreateCreditPurchaseBodySchema,
      response: CreateCreditPurchaseResponseSchema,
    },
  });
}
