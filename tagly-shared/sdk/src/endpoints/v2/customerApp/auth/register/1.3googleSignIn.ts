import {
  GoogleSignInBody,
  GoogleSignInBodySchema,
  GoogleSignInResponse,
  GoogleSignInResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/google`. Google sign-in / sign-up via a
 * native Google ID token. No OTP leg. Returns a JWT (login) or a
 * registrationToken + resume flags (registration).
 */
export function googleSignIn(
  body: GoogleSignInBody,
): ApiResponse<GoogleSignInResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/google",
    body,
    schemas: {
      body: GoogleSignInBodySchema,
      response: GoogleSignInResponseSchema,
    },
  });
}
