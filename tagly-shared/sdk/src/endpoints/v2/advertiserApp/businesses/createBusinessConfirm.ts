import {
  CreateBusinessConfirmBody,
  CreateBusinessConfirmBodySchema,
  CreateBusinessConfirmResponse,
  CreateBusinessConfirmResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/businesses/confirm`. Phase 2 of creating a
 * business page: validates the uploaded media, promotes the pending row, and
 * writes the optional detail fields (description, links, hours) atomically.
 * Authed (JWT).
 */
export function createBusinessConfirm({
  jwt,
  body,
}: {
  jwt: string;
  body: CreateBusinessConfirmBody;
}): ApiResponse<CreateBusinessConfirmResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/businesses/confirm",
    jwt,
    body,
    // Server-side media validation (S3 download + Rekognition per image) is
    // legitimately slower than the 15s default for a full banner+photos batch;
    // an aborted confirm leaves the server finishing the creation anyway.
    timeoutMs: 60_000,
    schemas: {
      body: CreateBusinessConfirmBodySchema,
      response: CreateBusinessConfirmResponseSchema,
    },
  });
}
