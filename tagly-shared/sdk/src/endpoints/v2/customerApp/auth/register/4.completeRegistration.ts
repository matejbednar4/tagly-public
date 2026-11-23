import {
  CompleteRegistrationBody,
  CompleteRegistrationBodySchema,
  CompleteRegistrationResponse,
  CompleteRegistrationResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/complete-registration`. Promote the
 * PendingCustomer to a Customer (final onboarding step). Instagram is optional:
 * pass `code` to link IG (rejected with 2214 if that IG already belongs to
 * another Customer — never a silent login into it), or omit it to finish without
 * IG. Returns a session JWT for the new account.
 */
export function completeRegistration(
  body: CompleteRegistrationBody,
): ApiResponse<CompleteRegistrationResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/complete-registration",
    body,
    schemas: {
      body: CompleteRegistrationBodySchema,
      response: CompleteRegistrationResponseSchema,
    },
  });
}
