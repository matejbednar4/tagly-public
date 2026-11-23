import {
  AdminAdvertiserUidParams,
  AdminAdvertiserUidParamsSchema,
  AdminSetAdvertiserReferrerBody,
  AdminSetAdvertiserReferrerBodySchema,
  AdminSetAdvertiserReferrerResponse,
  AdminSetAdvertiserReferrerResponseSchema,
} from "@tagly/models/v2/adminApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/admin/advertisers/:uid/referrer`. Record who referred an
 * advertiser after the fact (an influencer brought the business but the code
 * was never entered during onboarding). Set-only: an advertiser that already
 * has a referrer 409s. Authed (admin JWT, SUPER). Exported via
 * `@tagly/sdk/v2/adminApp`.
 */
export function adminSetAdvertiserReferrer({
  params,
  body,
  jwt,
}: {
  params: AdminAdvertiserUidParams;
  body: AdminSetAdvertiserReferrerBody;
  jwt: string;
}): ApiResponse<AdminSetAdvertiserReferrerResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/admin/advertisers/:uid/referrer",
    params,
    body,
    jwt,
    schemas: {
      params: AdminAdvertiserUidParamsSchema,
      body: AdminSetAdvertiserReferrerBodySchema,
      response: AdminSetAdvertiserReferrerResponseSchema,
    },
  });
}
