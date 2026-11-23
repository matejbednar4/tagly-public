import {
  AdminGetBlastSenderDomainsResponse,
  AdminGetBlastSenderDomainsResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/admin/notifications/sender-domains`. The sending identities a
 * blast can use, read live from Resend (verified domains only) plus the
 * default marketing sender. Authed (admin JWT, SUPER).
 */
export function adminGetBlastSenderDomains({
  jwt,
}: {
  jwt: string;
}): ApiResponse<AdminGetBlastSenderDomainsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/admin/notifications/sender-domains",
    jwt,
    schemas: {
      response: AdminGetBlastSenderDomainsResponseSchema,
    },
  });
}
