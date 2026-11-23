import {
  AdminUnratedSharesResponse,
  AdminUnratedSharesResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/shares/unrated`. APPROVED subsidized shares never rated
 * or reported (oldest first, fixed page + full total). Authed (admin JWT,
 * SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetUnratedShares({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminUnratedSharesResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/shares/unrated",
    jwt,
    schemas: {
      response: AdminUnratedSharesResponseSchema,
    },
  });
}
