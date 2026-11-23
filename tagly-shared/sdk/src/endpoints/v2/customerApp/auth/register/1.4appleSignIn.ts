import {
  AppleSignInBody,
  AppleSignInBodySchema,
  AppleSignInResponse,
  AppleSignInResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/apple`. Apple sign-in / sign-up via a
 * native Apple identity token. `fullName` is sent only on Apple's first
 * authorization. No OTP leg. Returns a JWT (login) or a registrationToken +
 * resume flags (registration).
 */
export function appleSignIn(
  body: AppleSignInBody,
): ApiResponse<AppleSignInResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/apple",
    body,
    schemas: {
      body: AppleSignInBodySchema,
      response: AppleSignInResponseSchema,
    },
  });
}
