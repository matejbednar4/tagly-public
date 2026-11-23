import {
  AdminBusinessUidParams,
  AdminBusinessUidParamsSchema,
  AdminGetBusinessResponse,
  AdminGetBusinessResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/businesses/:uid`. One business, full admin view.
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetBusinessByUid({
  params,
  jwt,
}: {
  params: AdminBusinessUidParams;
  jwt: string;
}): ApiResponse<AdminGetBusinessResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/businesses/:uid",
    params,
    jwt,
    schemas: {
      params: AdminBusinessUidParamsSchema,
      response: AdminGetBusinessResponseSchema,
    },
  });
}
