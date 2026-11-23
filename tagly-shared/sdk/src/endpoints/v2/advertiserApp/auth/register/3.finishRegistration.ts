import {
  FinishRegistrationBody,
  FinishRegistrationBodySchema,
  FinishRegistrationResponse,
  FinishRegistrationResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/advertisers/finish-registration`. Promote the
 * PendingAdvertiserAccount to an Advertiser (creates the bare account; business
 * setup follows). Returns a session JWT for the new account.
 */
export function finishRegistration(
  body: FinishRegistrationBody,
): ApiResponse<FinishRegistrationResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/advertisers/finish-registration",
    body,
    schemas: {
      body: FinishRegistrationBodySchema,
      response: FinishRegistrationResponseSchema,
    },
  });
}
