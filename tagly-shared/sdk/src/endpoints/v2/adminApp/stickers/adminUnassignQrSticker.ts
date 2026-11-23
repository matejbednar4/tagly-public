import {
  AdminUnassignQrStickerParams,
  AdminUnassignQrStickerParamsSchema,
  AdminUnassignQrStickerResponse,
  AdminUnassignQrStickerResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `DELETE /v2/admin/stickers/:id`. The sticker was physically removed
 * from its business — hard-deletes the mapping row (re-placing later is a
 * plain assign). 404 when not assigned. Authed (admin JWT, SUPER).
 */
export function adminUnassignQrSticker({
  jwt,
  params,
}: {
  jwt: string;
  params: AdminUnassignQrStickerParams;
}): ApiResponse<AdminUnassignQrStickerResponse | ApiError> {
  return request({
    method: "DELETE",
    path: "/v2/admin/stickers/:id",
    params,
    jwt,
    schemas: {
      params: AdminUnassignQrStickerParamsSchema,
      response: AdminUnassignQrStickerResponseSchema,
    },
  });
}
