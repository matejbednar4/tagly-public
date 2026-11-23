import {
  AdminReviewCountsResponse,
  AdminReviewCountsResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/review/counts`. Outstanding item count of every
 * moderation queue (pending approval / pending reports / unrated subsidized /
 * pending links). Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetReviewCounts({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminReviewCountsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/review/counts",
    jwt,
    schemas: {
      response: AdminReviewCountsResponseSchema,
    },
  });
}
