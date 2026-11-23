import {
  AdminShareUidParams,
  AdminShareUidParamsSchema,
  AdminGetShareResponse,
  AdminGetShareResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/shares/:uid`. One share, full admin view.
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetShareByUid({
  params,
  jwt,
}: {
  params: AdminShareUidParams;
  jwt: string;
}): ApiResponse<AdminGetShareResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/shares/:uid",
    params,
    jwt,
    schemas: {
      params: AdminShareUidParamsSchema,
      response: AdminGetShareResponseSchema,
    },
  });
}
