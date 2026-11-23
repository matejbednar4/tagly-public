import {
  StartChangeEmailBody,
  StartChangeEmailBodySchema,
  StartChangeEmailResponse,
  StartChangeEmailResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/email/start-change`. Sends a verification code to
 * the current + new email (dual-OTP change). Errors: 409 email in use (1102) /
 * same as current (1103). Authed (JWT).
 */
export function startChangeEmail({
  body,
  jwt,
}: {
  body: StartChangeEmailBody;
  jwt: string;
}): ApiResponse<StartChangeEmailResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/email/start-change",
    body,
    jwt,
    schemas: {
      body: StartChangeEmailBodySchema,
      response: StartChangeEmailResponseSchema,
    },
  });
}
