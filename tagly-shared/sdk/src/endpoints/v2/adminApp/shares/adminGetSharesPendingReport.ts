import {
  AdminSharesPendingReportResponse,
  AdminSharesPendingReportResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/shares/pending-report`. The report-review queue (oldest
 * report first, fixed page + full total). Authed (admin JWT, SUPER).
 * Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetSharesPendingReport({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminSharesPendingReportResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/shares/pending-report",
    jwt,
    schemas: {
      response: AdminSharesPendingReportResponseSchema,
    },
  });
}
