import {
  RegisterPendingPushTokenBody,
  RegisterPendingPushTokenBodySchema,
  RegisterPendingPushTokenResponse,
  RegisterPendingPushTokenResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/pending-push-token`. Register an Expo
 * push token against a PendingCustomer for pre-registration nudges.
 */
export function registerPendingPushToken(
  body: RegisterPendingPushTokenBody,
): ApiResponse<RegisterPendingPushTokenResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/pending-push-token",
    body,
    schemas: {
      body: RegisterPendingPushTokenBodySchema,
      response: RegisterPendingPushTokenResponseSchema,
    },
  });
}
