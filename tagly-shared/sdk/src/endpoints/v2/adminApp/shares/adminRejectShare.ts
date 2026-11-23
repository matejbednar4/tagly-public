import {
  AdminRejectShareBody,
  AdminRejectShareBodySchema,
  AdminRejectShareParams,
  AdminRejectShareParamsSchema,
  AdminRejectShareResponse,
  AdminRejectShareResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/shares/:uid/reject`. Intake-reject a PENDING share with
 * a customer-visible reason: penalizes the customer's multiplier and sends the
 * mandatory push+email. Authed (admin JWT, SUPER). Exported via
 * `@tagly/sdk/v2/adminApp`.
 */
export function adminRejectShare({
  params,
  body,
  jwt,
}: {
  params: AdminRejectShareParams;
  body: AdminRejectShareBody;
  jwt: string;
}): ApiResponse<AdminRejectShareResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/shares/:uid/reject",
    params,
    body,
    jwt,
    schemas: {
      params: AdminRejectShareParamsSchema,
      body: AdminRejectShareBodySchema,
      response: AdminRejectShareResponseSchema,
    },
  });
}
