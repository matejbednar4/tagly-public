import {
  SignOutOtherSessionsResponse,
  SignOutOtherSessionsResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/security/sign-out-others`. Revokes every other
 * session (bumps the token version) and returns a fresh JWT for THIS device, which
 * the caller must persist so it stays signed in. Authed (JWT).
 */
export function signOutOtherSessions({
  jwt,
}: {
  jwt: string;
}): ApiResponse<SignOutOtherSessionsResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/security/sign-out-others",
    jwt,
    schemas: {
      response: SignOutOtherSessionsResponseSchema,
    },
  });
}
