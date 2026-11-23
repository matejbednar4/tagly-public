import {
  StartConnectOnboardingResponse,
  StartConnectOnboardingResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/cash-out/onboarding`. Creates (or reuses) the
 * customer's Stripe Express account and returns a hosted onboarding link to
 * complete KYC. Authed (JWT).
 */
export function startConnectOnboarding({
  jwt,
}: {
  jwt: string;
}): ApiResponse<StartConnectOnboardingResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/cash-out/onboarding",
    jwt,
    schemas: {
      response: StartConnectOnboardingResponseSchema,
    },
  });
}
