import {
  UpdateReferrerCodeBody,
  UpdateReferrerCodeBodySchema,
  UpdateReferrerCodeResponse,
  UpdateReferrerCodeResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/update/referrer-code`. Set who referred this
 * advertiser (one-time, within the 24h sign-up window). Errors: 404 invalid code
 * (1004) / 409 own code (1005) / 403 window closed (1006). Authed (JWT).
 */
export function updateReferrerCode({
  body,
  jwt,
}: {
  body: UpdateReferrerCodeBody;
  jwt: string;
}): ApiResponse<UpdateReferrerCodeResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/update/referrer-code",
    body,
    jwt,
    schemas: {
      body: UpdateReferrerCodeBodySchema,
      response: UpdateReferrerCodeResponseSchema,
    },
  });
}
