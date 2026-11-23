import {
  AdminGetMeResponse,
  AdminGetMeResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/me`. The authenticated admin's profile (uid, email,
 * username, role); used to validate the session on launch. Authed (admin
 * bearer JWT). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetMe({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminGetMeResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/me",
    jwt,
    schemas: {
      response: AdminGetMeResponseSchema,
    },
  });
}
