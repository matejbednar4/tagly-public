import {
  CreateBusinessInitBody,
  CreateBusinessInitBodySchema,
  CreateBusinessInitResponse,
  CreateBusinessInitResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/businesses/init`. Phase 1 of creating a
 * business page: geocodes + creates the pending row and returns short-lived
 * presigned S3 POSTs (upload immediately, then call confirm). Authed (JWT).
 */
export function createBusinessInit({
  jwt,
  body,
}: {
  jwt: string;
  body: CreateBusinessInitBody;
}): ApiResponse<CreateBusinessInitResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/businesses/init",
    jwt,
    body,
    schemas: {
      body: CreateBusinessInitBodySchema,
      response: CreateBusinessInitResponseSchema,
    },
  });
}
