import {
  AdminAdvertiserUidParams,
  AdminAdvertiserUidParamsSchema,
  AdminGetAdvertiserResponse,
  AdminGetAdvertiserResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/advertisers/:uid`. One advertiser, full admin view.
 * Authed (admin JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminGetAdvertiserByUid({
  params,
  jwt,
}: {
  params: AdminAdvertiserUidParams;
  jwt: string;
}): ApiResponse<AdminGetAdvertiserResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/advertisers/:uid",
    params,
    jwt,
    schemas: {
      params: AdminAdvertiserUidParamsSchema,
      response: AdminGetAdvertiserResponseSchema,
    },
  });
}
