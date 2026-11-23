import {
  UpdateMarketingConsentBody,
  UpdateMarketingConsentBodySchema,
  UpdateMarketingConsentResponse,
  UpdateMarketingConsentResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/update/marketing-consent`. Set the promo opt-in
 * (one flag gates both promo email + push). Authed (JWT).
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
    path: "/v2/advertisers/me/update/marketing-consent",
    body,
    jwt,
    schemas: {
      body: UpdateMarketingConsentBodySchema,
      response: UpdateMarketingConsentResponseSchema,
    },
  });
}
