import {
  UpdateInterestsBody,
  UpdateInterestsBodySchema,
  UpdateInterestsResponse,
  UpdateInterestsResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/interests`. Replaces the customer's follower
 * interests (up to 3, by slug); a non-empty change is gated by a 60-day cooldown
 * (403 if too soon), clearing is always allowed. Authed (JWT).
 */
export function updateInterests({
  body,
  jwt,
}: {
  body: UpdateInterestsBody;
  jwt: string;
}): ApiResponse<UpdateInterestsResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/update/interests",
    body,
    jwt,
    schemas: {
      body: UpdateInterestsBodySchema,
      response: UpdateInterestsResponseSchema,
    },
  });
}
