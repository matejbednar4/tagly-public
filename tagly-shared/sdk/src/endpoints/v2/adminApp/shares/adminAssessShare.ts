import {
  AdminAssessShareBody,
  AdminAssessShareBodySchema,
  AdminAssessShareParams,
  AdminAssessShareParamsSchema,
  AdminAssessShareResponse,
  AdminAssessShareResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/shares/:uid/assess`. Rate (half-stars) or report a
 * SUBSIDIZED share in the missing advertiser's stead — once-only, same
 * semantics as the advertiser assessment. Authed (admin JWT, SUPER).
 * Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminAssessShare({
  params,
  body,
  jwt,
}: {
  params: AdminAssessShareParams;
  body: AdminAssessShareBody;
  jwt: string;
}): ApiResponse<AdminAssessShareResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/shares/:uid/assess",
    params,
    body,
    jwt,
    schemas: {
      params: AdminAssessShareParamsSchema,
      body: AdminAssessShareBodySchema,
      response: AdminAssessShareResponseSchema,
    },
  });
}
