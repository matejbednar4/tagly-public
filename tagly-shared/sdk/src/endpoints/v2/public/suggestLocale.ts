import {
  SuggestLocaleBody,
  SuggestLocaleBodySchema,
  SuggestLocaleResponse,
  SuggestLocaleResponseSchema,
} from "@tagly/models/v2/crossApp";
import { ApiResponse, request } from "../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/public/suggest-locale`. Pure locale derivation. Uses the clean
 * v2 schema (`@tagly/models/v2/crossApp`).
 * Exported via `@tagly/sdk/v2/crossApp`, so the name stays clean (no `V2` suffix).
 */
export function suggestLocale(
  body: SuggestLocaleBody,
): ApiResponse<SuggestLocaleResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/public/suggest-locale",
    body,
    schemas: {
      body: SuggestLocaleBodySchema,
      response: SuggestLocaleResponseSchema,
    },
  });
}
