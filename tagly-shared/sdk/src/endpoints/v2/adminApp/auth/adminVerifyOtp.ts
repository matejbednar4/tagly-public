import {
  AdminVerifyOtpBody,
  AdminVerifyOtpBodySchema,
  AdminVerifyOtpResponse,
  AdminVerifyOtpResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/admin/verify`. Step 2 of admin login: the long
 * emailed code. Returns the admin session **JWT** (bearer) in the body on
 * success. Public (no JWT). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminVerifyOtp({
  body,
}: {
  body: AdminVerifyOtpBody;
}): ApiResponse<AdminVerifyOtpResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/admin/verify",
    body,
    schemas: {
      body: AdminVerifyOtpBodySchema,
      response: AdminVerifyOtpResponseSchema,
    },
  });
}
