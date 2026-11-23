import {
  ConfirmDeleteAccountBody,
  ConfirmDeleteAccountBodySchema,
  ConfirmDeleteAccountResponse,
  ConfirmDeleteAccountResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/delete-account/confirm`. Verifies the deletion OTP,
 * sweeps any remaining balance to Stripe Connect, and hard-deletes the account.
 * Domain errors: 1200 funds locked, 1201 withdraw your balance first, 1202 sweep
 * in flight. OTP errors surface via the shared OTP error codes. Authed (JWT).
 */
export function confirmDeleteAccount({
  body,
  jwt,
}: {
  body: ConfirmDeleteAccountBody;
  jwt: string;
}): ApiResponse<ConfirmDeleteAccountResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/delete-account/confirm",
    body,
    jwt,
    schemas: {
      body: ConfirmDeleteAccountBodySchema,
      response: ConfirmDeleteAccountResponseSchema,
    },
  });
}
