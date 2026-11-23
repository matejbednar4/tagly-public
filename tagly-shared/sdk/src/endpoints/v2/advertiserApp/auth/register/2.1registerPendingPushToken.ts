import {
  RegisterPendingPushTokenBody,
  RegisterPendingPushTokenBodySchema,
  RegisterPendingPushTokenResponse,
  RegisterPendingPushTokenResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/advertisers/pending-push-token`. Register an Expo
 * push token against a PendingAdvertiserAccount (pre-registration nudges). The
 * token migrates to the Advertiser when registration completes.
 */
export function registerPendingPushToken(
  body: RegisterPendingPushTokenBody,
): ApiResponse<RegisterPendingPushTokenResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/advertisers/pending-push-token",
    body,
    schemas: {
      body: RegisterPendingPushTokenBodySchema,
      response: RegisterPendingPushTokenResponseSchema,
    },
  });
}
