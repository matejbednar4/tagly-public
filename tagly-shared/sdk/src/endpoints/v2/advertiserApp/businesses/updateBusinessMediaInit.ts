import {
  GetBusinessByUidParams,
  GetBusinessByUidParamsSchema,
  UpdateBusinessMediaInitBody,
  UpdateBusinessMediaInitBodySchema,
  UpdateBusinessMediaInitResponse,
  UpdateBusinessMediaInitResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/businesses/:uid/media/init`. Phase 1 of
 * editing a business page's banner/photos: declares the new uploads (+ which
 * existing photos are kept) and returns presigned S3 POSTs. Pure removals
 * skip init and call confirm directly. Authed (JWT).
 */
export function updateBusinessMediaInit({
  params,
  body,
  jwt,
}: {
  params: GetBusinessByUidParams;
  body: UpdateBusinessMediaInitBody;
  jwt: string;
}): ApiResponse<UpdateBusinessMediaInitResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/businesses/:uid/media/init",
    params,
    jwt,
    body,
    schemas: {
      params: GetBusinessByUidParamsSchema,
      body: UpdateBusinessMediaInitBodySchema,
      response: UpdateBusinessMediaInitResponseSchema,
    },
  });
}
