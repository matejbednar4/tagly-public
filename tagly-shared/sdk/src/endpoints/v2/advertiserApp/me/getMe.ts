import {
  GetMeResponse,
  GetMeResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me`. Fetch the logged-in advertiser's lean core
 * profile. Authed (JWT). Pure read — drives the setup gate (the derived
 * `funded` / `hasBusinessPage` facts) and locale-dependent UX.
 */
export function getMe({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetMeResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me",
    jwt,
    schemas: {
      response: GetMeResponseSchema,
    },
  });
}
