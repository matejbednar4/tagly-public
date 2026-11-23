import {
  AdminQrStickerIdParams,
  AdminQrStickerIdParamsSchema,
  AdminAssignQrStickerBody,
  AdminAssignQrStickerBodySchema,
  AdminAssignQrStickerResponse,
  AdminAssignQrStickerResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PUT /v2/admin/stickers/:id`. Assign a printed QR sticker number to a
 * business (upsert; first assignment creates the row). 409 code 5310 when the
 * sticker hangs in a different business and `reassign` wasn't set. Authed
 * (admin JWT, SUPER).
 */
export function adminAssignQrSticker({
  jwt,
  params,
  body,
}: {
  jwt: string;
  params: AdminQrStickerIdParams;
  body: AdminAssignQrStickerBody;
}): ApiResponse<AdminAssignQrStickerResponse | ApiError> {
  return request({
    method: "PUT",
    path: "/v2/admin/stickers/:id",
    params,
    jwt,
    body,
    schemas: {
      params: AdminQrStickerIdParamsSchema,
      body: AdminAssignQrStickerBodySchema,
      response: AdminAssignQrStickerResponseSchema,
    },
  });
}
