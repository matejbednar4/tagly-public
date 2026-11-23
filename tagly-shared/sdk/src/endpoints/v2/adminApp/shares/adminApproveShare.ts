import {
  AdminApproveShareParams,
  AdminApproveShareParamsSchema,
  AdminApproveShareResponse,
  AdminApproveShareResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/shares/:uid/approve`. Intake-approve a PENDING share:
 * flips it APPROVED, places the deferred budget lock, notifies the advertiser.
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminApproveShare({
  params,
  jwt,
}: {
  params: AdminApproveShareParams;
  jwt: string;
}): ApiResponse<AdminApproveShareResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/shares/:uid/approve",
    params,
    jwt,
    schemas: {
      params: AdminApproveShareParamsSchema,
      response: AdminApproveShareResponseSchema,
    },
  });
}
