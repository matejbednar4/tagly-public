import {
  SaveMarketingConsentBody,
  SaveMarketingConsentBodySchema,
  SaveMarketingConsentResponse,
  SaveMarketingConsentResponseSchema,
} from "@tagly/models/v2/customerApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/customers/save-marketing-consent`. Persist the
 * promo-notifications opt-in from the dedicated EU/CZ promo screen. US clients
 * skip this (auto-opted-in at account creation).
 */
export function saveMarketingConsent(
  body: SaveMarketingConsentBody,
): ApiResponse<SaveMarketingConsentResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/customers/save-marketing-consent",
    body,
    schemas: {
      body: SaveMarketingConsentBodySchema,
      response: SaveMarketingConsentResponseSchema,
    },
  });
}
