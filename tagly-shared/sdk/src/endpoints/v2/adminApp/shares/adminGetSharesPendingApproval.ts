import {
  AdminSharesPendingApprovalResponse,
  AdminSharesPendingApprovalResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/shares/pending-approval`. The intake moderation queue
 * (oldest first, fixed page + full total). Authed (admin JWT, SUPER).
 * Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetSharesPendingApproval({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminSharesPendingApprovalResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/shares/pending-approval",
    jwt,
    schemas: {
      response: AdminSharesPendingApprovalResponseSchema,
    },
  });
}
