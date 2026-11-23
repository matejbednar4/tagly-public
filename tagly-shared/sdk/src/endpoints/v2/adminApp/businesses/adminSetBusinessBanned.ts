import {
  AdminBusinessUidParams,
  AdminBusinessUidParamsSchema,
  AdminSetBusinessBannedBody,
  AdminSetBusinessBannedBodySchema,
  AdminSetBusinessBannedResponse,
  AdminSetBusinessBannedResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PATCH /v2/admin/businesses/:uid/banned`. Ban (ACTIVE→BANNED) or
 * unban (BANNED→ACTIVE) a business page; a banned page is customer-hidden
 * immediately. Returns the full `AdminBusiness`. Authed (admin JWT, SUPER).
 */
export function adminSetBusinessBanned({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminBusinessUidParams;
  body: AdminSetBusinessBannedBody;
}): ApiResponse<AdminSetBusinessBannedResponse | ApiError> {
  return request({
    method: "PATCH",
    path: "/v2/admin/businesses/:uid/banned",
    params,
    jwt,
    body,
    schemas: {
      params: AdminBusinessUidParamsSchema,
      body: AdminSetBusinessBannedBodySchema,
      response: AdminSetBusinessBannedResponseSchema,
    },
  });
}
