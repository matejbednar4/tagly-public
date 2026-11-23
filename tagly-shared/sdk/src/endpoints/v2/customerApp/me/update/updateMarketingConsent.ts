import {
  UpdateMarketingConsentBody,
  UpdateMarketingConsentBodySchema,
  UpdateMarketingConsentResponse,
  UpdateMarketingConsentResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/customers/me/update/marketing-consent`. Sets the marketing
 * opt-in flag (email + push promo, gated together). Authed (JWT). No cooldown.
 */
export function updateMarketingConsent({
  body,
  jwt,
}: {
  body: UpdateMarketingConsentBody;
  jwt: string;
}): ApiResponse<UpdateMarketingConsentResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/customers/me/update/marketing-consent",
    body,
    jwt,
    schemas: {
      body: UpdateMarketingConsentBodySchema,
      response: UpdateMarketingConsentResponseSchema,
    },
  });
}
