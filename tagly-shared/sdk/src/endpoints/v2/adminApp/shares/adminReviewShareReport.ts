import {
  AdminReviewShareReportBody,
  AdminReviewShareReportBodySchema,
  AdminReviewShareReportParams,
  AdminReviewShareReportParamsSchema,
  AdminReviewShareReportResponse,
  AdminReviewShareReportResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PUT /v2/admin/shares/:uid/report-review`. Resolve a PENDING report:
 * VALID upholds it (budget returned, escalating penalty, never paid);
 * DISMISSED clears it with a required admin quality rating (payout proceeds).
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminReviewShareReport({
  params,
  body,
  jwt,
}: {
  params: AdminReviewShareReportParams;
  body: AdminReviewShareReportBody;
  jwt: string;
}): ApiResponse<AdminReviewShareReportResponse | ApiError> {
  return request({
    method: "PUT",
    path: "/v2/admin/shares/:uid/report-review",
    params,
    body,
    jwt,
    schemas: {
      params: AdminReviewShareReportParamsSchema,
      body: AdminReviewShareReportBodySchema,
      response: AdminReviewShareReportResponseSchema,
    },
  });
}
