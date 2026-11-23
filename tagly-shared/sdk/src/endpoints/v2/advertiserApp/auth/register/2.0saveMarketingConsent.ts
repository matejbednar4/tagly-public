import {
  SaveMarketingConsentBody,
  SaveMarketingConsentBodySchema,
  SaveMarketingConsentResponse,
  SaveMarketingConsentResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/auth/advertisers/save-marketing-consent`. Persist the
 * promo opt-in onto the PendingAdvertiserAccount (EU-gated screen; US auto-opts
 * in at creation and skips this call).
 */
export function saveMarketingConsent(
  body: SaveMarketingConsentBody,
): ApiResponse<SaveMarketingConsentResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/auth/advertisers/save-marketing-consent",
    body,
    schemas: {
      body: SaveMarketingConsentBodySchema,
      response: SaveMarketingConsentResponseSchema,
    },
  });
}
