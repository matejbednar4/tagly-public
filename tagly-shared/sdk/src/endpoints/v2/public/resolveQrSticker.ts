import {
  ResolveQrStickerParams,
  ResolveQrStickerParamsSchema,
  ResolveQrStickerResponse,
  ResolveQrStickerResponseSchema,
} from "@tagly/models/v2/crossApp";
import { ApiResponse, request } from "../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/public/stickers/:id`. Resolves a printed QR sticker number to
 * its business ({ uid, name, referralCode }) for tagly-join landing
 * personalization. Unauthenticated; 404 = unassigned/unknown sticker (render
 * the generic landing).
 */
export function resolveQrSticker(
  params: ResolveQrStickerParams,
): ApiResponse<ResolveQrStickerResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/public/stickers/:id",
    params,
    schemas: {
      params: ResolveQrStickerParamsSchema,
      response: ResolveQrStickerResponseSchema,
    },
  });
}
