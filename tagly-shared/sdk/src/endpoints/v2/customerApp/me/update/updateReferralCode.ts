import {
  UpdateReferralCodeBody,
  UpdateReferralCodeBodySchema,
  UpdateReferralCodeResponse,
  UpdateReferralCodeResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/referral-code`. Changes the customer's own
 * referral code; a one-time change (403 once already used) with a uniqueness
 * check (409 if taken). Authed (JWT).
 */
export function updateReferralCode({
  body,
  jwt,
}: {
  body: UpdateReferralCodeBody;
  jwt: string;
}): ApiResponse<UpdateReferralCodeResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/update/referral-code",
    body,
    jwt,
    schemas: {
      body: UpdateReferralCodeBodySchema,
      response: UpdateReferralCodeResponseSchema,
    },
  });
}
