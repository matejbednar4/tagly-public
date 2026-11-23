import {
  AdminPendingLinksResponse,
  AdminPendingLinksResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/links/pending`. Business links awaiting review, with the
 * businesses referencing each URL (oldest first, fixed page + full total).
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetPendingLinks({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminPendingLinksResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/links/pending",
    jwt,
    schemas: {
      response: AdminPendingLinksResponseSchema,
    },
  });
}
