import {
  ResendOtpBody,
  ResendOtpBodySchema,
  ResendOtpResponse,
  ResendOtpResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/resend-otp`. Resend the email OTP for an
 * in-progress login or registration.
 */
export function resendOtp(
  body: ResendOtpBody,
): ApiResponse<ResendOtpResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/resend-otp",
    body,
    schemas: {
      body: ResendOtpBodySchema,
      response: ResendOtpResponseSchema,
    },
  });
}
