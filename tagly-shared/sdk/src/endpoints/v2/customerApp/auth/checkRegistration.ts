import {
  CheckRegistrationQuery,
  CheckRegistrationQuerySchema,
  CheckRegistrationResponse,
  CheckRegistrationResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/public/auth/customers/check-registration`. Resolve where to
 * resume onboarding from a stored registrationToken on app launch.
 */
export function checkRegistration(
  query: CheckRegistrationQuery,
): ApiResponse<CheckRegistrationResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/public/auth/customers/check-registration",
    query,
    schemas: {
      query: CheckRegistrationQuerySchema,
      response: CheckRegistrationResponseSchema,
    },
  });
}
