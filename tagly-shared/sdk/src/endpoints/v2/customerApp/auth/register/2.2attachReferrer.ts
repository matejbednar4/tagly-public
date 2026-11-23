import {
  AttachReferrerBody,
  AttachReferrerBodySchema,
  AttachReferrerResponse,
  AttachReferrerResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/attach-referrer`. Attach a deeplink
 * referrer code to the pending customer. Call this **only when the user was
 * referred**, after the client has a registrationToken (post-OTP / post-OAuth).
 * Resolved into the referral at complete-registration.
 */
export function attachReferrer(
  body: AttachReferrerBody,
): ApiResponse<AttachReferrerResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/attach-referrer",
    body,
    schemas: {
      body: AttachReferrerBodySchema,
      response: AttachReferrerResponseSchema,
    },
  });
}
