import {
  AdminGetBlastsResponse,
  AdminGetBlastsResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/notifications/blasts`. Recent blasts (newest first) with
 * live queue delivery stats (stats decay with queue retention — null once the
 * rows are cleaned up; `queuedCount` is the permanent number). Authed (admin
 * JWT, SUPER).
 */
export function adminGetBlasts({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminGetBlastsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/notifications/blasts",
    jwt,
    schemas: {
      response: AdminGetBlastsResponseSchema,
    },
  });
}
