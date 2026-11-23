import {
  AdminBusinessUidParams,
  AdminBusinessUidParamsSchema,
  AdminUpdateBusinessBody,
  AdminUpdateBusinessBodySchema,
  AdminUpdateBusinessResponse,
  AdminUpdateBusinessResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PATCH /v2/admin/businesses/:uid`. Edit ANY business page (owned or
 * unowned; ACTIVE or BANNED). Field semantics: omitted = unchanged, `null` =
 * clear, `openingHours`/`tags` present = replace-all. Returns the full
 * `AdminBusiness`. Authed (admin JWT, SUPER).
 */
export function adminUpdateBusiness({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminBusinessUidParams;
  body: AdminUpdateBusinessBody;
}): ApiResponse<AdminUpdateBusinessResponse | ApiError> {
  return request({
    method: "PATCH",
    path: "/v2/admin/businesses/:uid",
    params,
    jwt,
    body,
    schemas: {
      params: AdminBusinessUidParamsSchema,
      body: AdminUpdateBusinessBodySchema,
      response: AdminUpdateBusinessResponseSchema,
    },
  });
}
