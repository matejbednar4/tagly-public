import {
  ConfirmDeleteAccountBody,
  ConfirmDeleteAccountBodySchema,
  ConfirmDeleteAccountResponse,
  ConfirmDeleteAccountResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/delete-account/confirm`. Verifies the OTP,
 * forfeits any remaining credit balance, marks unpaid shares UNPAYABLE, and
 * hard-deletes the account. OTP + domain errors surface via error codes. Authed
 * (JWT).
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
    path: "/v2/advertisers/me/delete-account/confirm",
    body,
    jwt,
    schemas: {
      body: ConfirmDeleteAccountBodySchema,
      response: ConfirmDeleteAccountResponseSchema,
    },
  });
}
