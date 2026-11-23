import {
  InstagramLoginBody,
  InstagramLoginBodySchema,
  InstagramLoginResponse,
  InstagramLoginResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/instagram-login`. Log in via Instagram
 * for users who forgot their email. Returns a session JWT.
 */
export function instagramLogin(
  body: InstagramLoginBody,
): ApiResponse<InstagramLoginResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/instagram-login",
    body,
    schemas: {
      body: InstagramLoginBodySchema,
      response: InstagramLoginResponseSchema,
    },
  });
}
