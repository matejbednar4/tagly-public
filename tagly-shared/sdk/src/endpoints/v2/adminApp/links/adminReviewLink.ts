import {
  AdminReviewLinkBody,
  AdminReviewLinkBodySchema,
  AdminReviewLinkParams,
  AdminReviewLinkParamsSchema,
  AdminReviewLinkResponse,
  AdminReviewLinkResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/links/:id/review`. Approve (goes live everywhere) or
 * reject (global kill-switch) a PENDING link. Authed (admin JWT, SUPER).
 * Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminReviewLink({
  params,
  body,
  jwt,
}: {
  params: AdminReviewLinkParams;
  body: AdminReviewLinkBody;
  jwt: string;
}): ApiResponse<AdminReviewLinkResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/links/:id/review",
    params,
    body,
    jwt,
    schemas: {
      params: AdminReviewLinkParamsSchema,
      body: AdminReviewLinkBodySchema,
      response: AdminReviewLinkResponseSchema,
    },
  });
}
