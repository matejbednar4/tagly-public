import {
  VerifyOtpBody,
  VerifyOtpBodySchema,
  VerifyOtpResponse,
  VerifyOtpResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/advertisers/verify-otp`. Verify the emailed OTP for
 * login or registration. Returns a JWT (login) or a registrationToken + resume
 * state (registration).
 */
export function verifyOtp(
  body: VerifyOtpBody,
): ApiResponse<VerifyOtpResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/advertisers/verify-otp",
    body,
    schemas: {
      body: VerifyOtpBodySchema,
      response: VerifyOtpResponseSchema,
    },
  });
}
