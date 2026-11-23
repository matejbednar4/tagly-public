import {
  AdminBusinessUidParams,
  AdminBusinessUidParamsSchema,
  AdminSetBusinessAdvertiserBody,
  AdminSetBusinessAdvertiserBodySchema,
  AdminSetBusinessAdvertiserResponse,
  AdminSetBusinessAdvertiserResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PATCH /v2/admin/businesses/:uid/advertiser`. The onboarding-assist
 * handover: assign an admin-created UNOWNED page to an advertiser. Hard-gated
 * server-side (ACTIVE, unowned, never subsidized, never any shares, locale ↔
 * country match). Returns the full `AdminBusiness`. Authed (admin JWT, SUPER).
 */
export function adminSetBusinessAdvertiser({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminBusinessUidParams;
  body: AdminSetBusinessAdvertiserBody;
}): ApiResponse<AdminSetBusinessAdvertiserResponse | ApiError> {
  return request({
    method: "PATCH",
    path: "/v2/admin/businesses/:uid/advertiser",
    params,
    jwt,
    body,
    schemas: {
      params: AdminBusinessUidParamsSchema,
      body: AdminSetBusinessAdvertiserBodySchema,
      response: AdminSetBusinessAdvertiserResponseSchema,
    },
  });
}
