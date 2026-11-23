import {
  CreateShareBody,
  CreateShareBodySchema,
  CreateShareResponse,
  CreateShareResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/shares/create`. Create a share for a business from one
 * of the customer's live Instagram stories. The body carries only the identifiers
 * (`businessUid` + `storyId`) plus the hard consent flag
 * (`agreedToTermsOfMonetization: true`); the backend reads every media field from
 * the authoritative live story it fetches from Instagram. Authed (JWT).
 *
 * Rate-limited per-user on its own bucket (~1 req / 30s, separate from the stories
 * fetch) and runs Instagram + Rekognition work, so it can return a range of domain
 * errors the caller maps to user-facing copy (story not live, already shared,
 * business out of budget, story doesn't clearly tag the business, …).
 */
export function createShare({
  jwt,
  body,
}: {
  jwt: string;
  body: CreateShareBody;
}): ApiResponse<CreateShareResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/shares/create",
    jwt,
    body,
    schemas: {
      body: CreateShareBodySchema,
      response: CreateShareResponseSchema,
    },
  });
}
