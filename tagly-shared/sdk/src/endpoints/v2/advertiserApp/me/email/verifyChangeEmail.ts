import {
  VerifyChangeEmailBody,
  VerifyChangeEmailBodySchema,
  VerifyChangeEmailResponse,
  VerifyChangeEmailResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/email/verify-change`. Verifies both OTP codes and
 * swaps the email. OTP errors surface via the shared OTP error codes. Authed (JWT).
 */
export function verifyChangeEmail({
  body,
  jwt,
}: {
  body: VerifyChangeEmailBody;
  jwt: string;
}): ApiResponse<VerifyChangeEmailResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/email/verify-change",
    body,
    jwt,
    schemas: {
      body: VerifyChangeEmailBodySchema,
      response: VerifyChangeEmailResponseSchema,
    },
  });
}
