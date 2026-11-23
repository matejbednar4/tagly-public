import {
  AppleSignInBody,
  AppleSignInBodySchema,
  AppleSignInResponse,
  AppleSignInResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/advertisers/apple`. Apple sign-in / sign-up via a
 * native Apple identity token. No OTP leg. Returns a JWT (login) or a
 * registrationToken + resume flags (registration).
 */
export function appleSignIn(
  body: AppleSignInBody,
): ApiResponse<AppleSignInResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/advertisers/apple",
    body,
    schemas: {
      body: AppleSignInBodySchema,
      response: AppleSignInResponseSchema,
    },
  });
}
