import {
  SettleNegativeBalanceResponse,
  SettleNegativeBalanceResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/billing/settle-balance`. Pay off a negative
 * available balance (uncollectable PAYG debt). No body: the amount is
 * server-computed from the debt (floored at Stripe's minimum) and echoed back as
 * `amountCents` alongside the PaymentSheet handoff. Crediting is webhook-driven,
 * exactly like a credit purchase. Authed (JWT).
 */
export function settleNegativeBalance({
  jwt,
}: {
  jwt: string;
}): ApiResponse<SettleNegativeBalanceResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/billing/settle-balance",
    jwt,
    schemas: {
      response: SettleNegativeBalanceResponseSchema,
    },
  });
}
