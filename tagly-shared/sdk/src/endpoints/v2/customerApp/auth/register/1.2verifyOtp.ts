import {
  VerifyOtpBody,
  VerifyOtpBodySchema,
  VerifyOtpResponse,
  VerifyOtpResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/verify-otp`. Verify the emailed OTP for
 * login or registration. Carries no consent fields. Returns a JWT (login) or a
 * registrationToken + resume flags (registration).
 */
export function verifyOtp(
  body: VerifyOtpBody,
): ApiResponse<VerifyOtpResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/verify-otp",
    body,
    schemas: {
      body: VerifyOtpBodySchema,
      response: VerifyOtpResponseSchema,
    },
  });
}
