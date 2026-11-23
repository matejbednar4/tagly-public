import {
  StartEmailBody,
  StartEmailBodySchema,
  StartEmailResponse,
  StartEmailResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/advertisers/start-email`. Unified email entry for
 * login + registration. ToS/Privacy are stamped passively at account creation;
 * no consent fields are sent. Exported via `@tagly/sdk/v2/advertiserApp`.
 */
export function startEmail(
  body: StartEmailBody,
): ApiResponse<StartEmailResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/advertisers/start-email",
    body,
    schemas: {
      body: StartEmailBodySchema,
      response: StartEmailResponseSchema,
    },
  });
}
