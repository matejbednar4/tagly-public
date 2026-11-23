import {
  AdminBusinessUidParams,
  AdminBusinessUidParamsSchema,
  AdminUpdateBusinessMediaInitBody,
  AdminUpdateBusinessMediaInitBodySchema,
  AdminUpdateBusinessMediaInitResponse,
  AdminUpdateBusinessMediaInitResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/businesses/:uid/media/init`. Phase 1 of an admin
 * editing a business page's banner/photos (keep-by-uid; pure removals skip
 * init and call confirm directly). Authed (admin JWT, SUPER).
 */
export function adminUpdateBusinessMediaInit({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminBusinessUidParams;
  body: AdminUpdateBusinessMediaInitBody;
}): ApiResponse<AdminUpdateBusinessMediaInitResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/businesses/:uid/media/init",
    params,
    jwt,
    body,
    schemas: {
      params: AdminBusinessUidParamsSchema,
      body: AdminUpdateBusinessMediaInitBodySchema,
      response: AdminUpdateBusinessMediaInitResponseSchema,
    },
  });
}
