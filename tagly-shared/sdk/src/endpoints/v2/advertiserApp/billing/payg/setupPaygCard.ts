import {
  SetupPaygCardBody,
  SetupPaygCardBodySchema,
  SetupPaygCardResponse,
  SetupPaygCardResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/billing/payg/setup-intent`. Start linking a
 * PAYG card: stamps the off-session charge authorization and returns the
 * SetupIntent client secret (+ customer & ephemeral key) for the native
 * PaymentSheet. Authed (JWT).
 *
 * @deprecated Back-compat only — the app now links the card with
 * `setupSavedCard` and turns PAYG on with `enablePayg`. Kept so the shipped
 * route stays typed; delete once pre-2026-09 builds roll off.
 */
export function setupPaygCard({
  jwt,
  body,
}: {
  jwt: string;
  body: SetupPaygCardBody;
}): ApiResponse<SetupPaygCardResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/billing/payg/setup-intent",
    jwt,
    body,
    schemas: {
      body: SetupPaygCardBodySchema,
      response: SetupPaygCardResponseSchema,
    },
  });
}
