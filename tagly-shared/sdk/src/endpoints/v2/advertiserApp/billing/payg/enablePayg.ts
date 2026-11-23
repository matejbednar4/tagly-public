import {
  EnablePaygBody,
  EnablePaygBodySchema,
  EnablePaygResponse,
  EnablePaygResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/billing/payg`. Turn pay-as-you-go on with the
 * saved card already on file (no PaymentSheet). Requires a saved card (1350).
 * Authed (JWT).
 */
export function enablePayg({
  jwt,
  body,
}: {
  jwt: string;
  body: EnablePaygBody;
}): ApiResponse<EnablePaygResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/billing/payg",
    jwt,
    body,
    schemas: {
      body: EnablePaygBodySchema,
      response: EnablePaygResponseSchema,
    },
  });
}
