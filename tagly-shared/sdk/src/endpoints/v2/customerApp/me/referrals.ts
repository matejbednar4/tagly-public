import {
  GetReferralsResponse,
  GetReferralsResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/customers/me/referrals`. The customer's referral code, status,
 * referrer, referred counts, and lifetime referral earnings. Authed (JWT). Pure
 * read.
 */
export function getReferrals({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetReferralsResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/customers/me/referrals",
    jwt,
    schemas: {
      response: GetReferralsResponseSchema,
    },
  });
}
