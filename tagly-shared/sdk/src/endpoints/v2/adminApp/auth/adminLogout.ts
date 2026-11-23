import {
  AdminLogoutResponse,
  AdminLogoutResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/logout`. Server-side revocation: bumps the admin's
 * `jwtVersion` so all their live tokens become invalid. The client also discards
 * its stored bearer. Authed (admin JWT). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminLogout({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminLogoutResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/logout",
    jwt,
    schemas: {
      response: AdminLogoutResponseSchema,
    },
  });
}
