import {
  AdminCreateBusinessConfirmBody,
  AdminCreateBusinessConfirmBodySchema,
  AdminCreateBusinessConfirmResponse,
  AdminCreateBusinessConfirmResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/businesses/confirm`. Phase 2 of an admin creating a
 * business page: validates uploads (banner 16:9 + moderation), promotes the
 * pending row (unowned) and writes the detail fields + admin-only `tags`
 * atomically. Returns the full `AdminBusiness`. Authed (admin JWT, SUPER).
 */
export function adminCreateBusinessConfirm({
  jwt,
  body,
}: {
  jwt: string;
  body: AdminCreateBusinessConfirmBody;
}): ApiResponse<AdminCreateBusinessConfirmResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/businesses/confirm",
    jwt,
    body,
    schemas: {
      body: AdminCreateBusinessConfirmBodySchema,
      response: AdminCreateBusinessConfirmResponseSchema,
    },
  });
}
