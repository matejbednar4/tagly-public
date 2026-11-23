import {
  AdminLoginBody,
  AdminLoginBodySchema,
  AdminLoginResponse,
  AdminLoginResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/admin/login`. Step 1 of admin login: email
 * (`@flaer.app`) + password. On valid credentials a long code is emailed; the
 * response is a generic message either way (anti-enumeration). Public (no JWT).
 * Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminLogin({
  body,
}: {
  body: AdminLoginBody;
}): ApiResponse<AdminLoginResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/admin/login",
    body,
    schemas: {
      body: AdminLoginBodySchema,
      response: AdminLoginResponseSchema,
    },
  });
}
