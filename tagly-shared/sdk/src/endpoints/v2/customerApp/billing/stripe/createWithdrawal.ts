import {
  CreateWithdrawalBody,
  CreateWithdrawalBodySchema,
  CreateWithdrawalResponse,
  CreateWithdrawalResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/cash-out/withdraw`. Cashes out `amountCents` from
 * the customer's Tagly balance to their Stripe Connect account (standard payout to
 * their bank). Returns the created withdrawal with its display state. Authed (JWT).
 */
export function createWithdrawal({
  body,
  jwt,
}: {
  body: CreateWithdrawalBody;
  jwt: string;
}): ApiResponse<CreateWithdrawalResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/cash-out/withdraw",
    body,
    jwt,
    schemas: {
      body: CreateWithdrawalBodySchema,
      response: CreateWithdrawalResponseSchema,
    },
  });
}
