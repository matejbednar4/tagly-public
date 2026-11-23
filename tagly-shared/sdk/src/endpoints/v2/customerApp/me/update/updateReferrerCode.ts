import {
  UpdateReferrerCodeBody,
  UpdateReferrerCodeBodySchema,
  UpdateReferrerCodeResponse,
  UpdateReferrerCodeResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/referrer-code`. Sets who referred the
 * customer (one-time, only within 24h of sign-up). Errors: 404 invalid code,
 * 409 self / already-set, 403 outside the window. Authed (JWT).
 */
export function updateReferrerCode({
  body,
  jwt,
}: {
  body: UpdateReferrerCodeBody;
  jwt: string;
}): ApiResponse<UpdateReferrerCodeResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/update/referrer-code",
    body,
    jwt,
    schemas: {
      body: UpdateReferrerCodeBodySchema,
      response: UpdateReferrerCodeResponseSchema,
    },
  });
}
