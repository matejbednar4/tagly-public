import {
  AdminCreateBusinessInitBody,
  AdminCreateBusinessInitBodySchema,
  AdminCreateBusinessInitResponse,
  AdminCreateBusinessInitResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/businesses/init`. Phase 1 of an admin creating an
 * UNOWNED business page (subsidized track — subsidizing is a separate
 * action): geocodes + creates the pending row and returns short-lived
 * presigned S3 POSTs (upload immediately, then call confirm). Authed (admin
 * JWT, SUPER). Exported via `@tagly/sdk/v2/adminApp`.
 */
export function adminCreateBusinessInit({
  jwt,
  body,
}: {
  jwt: string;
  body: AdminCreateBusinessInitBody;
}): ApiResponse<AdminCreateBusinessInitResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/businesses/init",
    jwt,
    body,
    schemas: {
      body: AdminCreateBusinessInitBodySchema,
      response: AdminCreateBusinessInitResponseSchema,
    },
  });
}
