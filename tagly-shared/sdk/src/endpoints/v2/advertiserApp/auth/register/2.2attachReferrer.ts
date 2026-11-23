import {
  AttachReferrerBody,
  AttachReferrerBodySchema,
  AttachReferrerResponse,
  AttachReferrerResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/advertisers/attach-referrer`. Store a referrer code
 * on the verified PendingAdvertiserAccount (called only when the advertiser
 * arrived via a referral deeplink). Resolved at complete-registration.
 */
export function attachReferrer(
  body: AttachReferrerBody,
): ApiResponse<AttachReferrerResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/advertisers/attach-referrer",
    body,
    schemas: {
      body: AttachReferrerBodySchema,
      response: AttachReferrerResponseSchema,
    },
  });
}
