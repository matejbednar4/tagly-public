import {
  AdminBusinessUidParams,
  AdminBusinessUidParamsSchema,
  AdminUpdateBusinessMediaConfirmBody,
  AdminUpdateBusinessMediaConfirmBodySchema,
  AdminUpdateBusinessMediaConfirmResponse,
  AdminUpdateBusinessMediaConfirmResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/businesses/:uid/media/confirm`. Phase 2 of an admin
 * editing a business page's banner/photos (`keepPhotoUids` is the
 * authoritative keep list). Returns the full `AdminBusiness`. Authed (admin
 * JWT, SUPER).
 */
export function adminUpdateBusinessMediaConfirm({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminBusinessUidParams;
  body: AdminUpdateBusinessMediaConfirmBody;
}): ApiResponse<AdminUpdateBusinessMediaConfirmResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/businesses/:uid/media/confirm",
    params,
    jwt,
    body,
    schemas: {
      params: AdminBusinessUidParamsSchema,
      body: AdminUpdateBusinessMediaConfirmBodySchema,
      response: AdminUpdateBusinessMediaConfirmResponseSchema,
    },
  });
}
