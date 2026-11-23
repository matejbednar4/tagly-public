import {
  UpdateReferralCodeBody,
  UpdateReferralCodeBodySchema,
  UpdateReferralCodeResponse,
  UpdateReferralCodeResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/update/referral-code`. Change the advertiser's own
 * referral code (one-time + globally unique). Errors: 409 code taken (1220) /
 * 403 already changed (1219). Authed (JWT).
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
    path: "/v2/advertisers/me/update/referral-code",
    body,
    jwt,
    schemas: {
      body: UpdateReferralCodeBodySchema,
      response: UpdateReferralCodeResponseSchema,
    },
  });
}
