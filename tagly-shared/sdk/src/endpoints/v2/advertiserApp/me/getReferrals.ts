import {
  GetAdvertiserReferralsResponse,
  GetAdvertiserReferralsResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me/referrals`. The advertiser's referral code,
 * status, referrer, referred counts, and lifetime referral earnings. Authed
 * (JWT). Pure read.
 */
export function getAdvertiserReferrals({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetAdvertiserReferralsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me/referrals",
    jwt,
    schemas: {
      response: GetAdvertiserReferralsResponseSchema,
    },
  });
}
