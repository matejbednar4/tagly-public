import {
  StartDeleteAccountResponse,
  StartDeleteAccountResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/delete-account/start`. Sends an account-deletion
 * code to the advertiser's current email. Idempotent (resend gated client-side).
 * Authed (JWT).
 */
export function startDeleteAccount({
  jwt,
}: {
  jwt: string;
}): ApiResponse<StartDeleteAccountResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/delete-account/start",
    body: {},
    jwt,
    schemas: {
      response: StartDeleteAccountResponseSchema,
    },
  });
}
