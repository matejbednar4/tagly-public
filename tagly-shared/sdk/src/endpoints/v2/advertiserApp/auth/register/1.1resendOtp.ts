import {
  ResendOtpBody,
  ResendOtpBodySchema,
  ResendOtpResponse,
  ResendOtpResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/advertisers/resend-otp`. Resend the email OTP for
 * an in-progress advertiser login or registration (rate-limited server-side).
 */
export function resendOtp(
  body: ResendOtpBody,
): ApiResponse<ResendOtpResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/advertisers/resend-otp",
    body,
    schemas: {
      body: ResendOtpBodySchema,
      response: ResendOtpResponseSchema,
    },
  });
}
