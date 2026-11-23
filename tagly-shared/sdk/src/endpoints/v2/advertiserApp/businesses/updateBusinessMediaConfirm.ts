import {
  GetBusinessByUidParams,
  GetBusinessByUidParamsSchema,
  UpdateBusinessMediaConfirmBody,
  UpdateBusinessMediaConfirmBodySchema,
  UpdateBusinessMediaConfirmResponse,
  UpdateBusinessMediaConfirmResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/businesses/:uid/media/confirm`. Phase 2 of
 * editing a business page's banner/photos: validates the uploads (16:9 +
 * moderation), swaps the banner, attaches new photos, and removes everything
 * not in `keepPhotoUids` — atomically. Authed (JWT).
 */
export function updateBusinessMediaConfirm({
  params,
  body,
  jwt,
}: {
  params: GetBusinessByUidParams;
  body: UpdateBusinessMediaConfirmBody;
  jwt: string;
}): ApiResponse<UpdateBusinessMediaConfirmResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/businesses/:uid/media/confirm",
    params,
    jwt,
    body,
    // Server-side media validation (S3 download + Rekognition per image) is
    // legitimately slower than the 15s default — same budget as create confirm.
    timeoutMs: 60_000,
    schemas: {
      params: GetBusinessByUidParamsSchema,
      body: UpdateBusinessMediaConfirmBodySchema,
      response: UpdateBusinessMediaConfirmResponseSchema,
    },
  });
}
