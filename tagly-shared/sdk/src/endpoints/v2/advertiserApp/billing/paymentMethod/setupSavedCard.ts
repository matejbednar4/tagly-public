import {
  SetupSavedCardBody,
  SetupSavedCardBodySchema,
  SetupSavedCardResponse,
  SetupSavedCardResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/billing/payment-method/setup-intent`. Start
 * linking (or replacing) the account's saved off-session card without turning
 * any feature on — the purpose-neutral twin of `setupPaygCard`, used when the
 * card is added for the monthly budget. Returns the PaymentSheet handoff.
 * Authed (JWT).
 */
export function setupSavedCard({
  jwt,
  body,
}: {
  jwt: string;
  body: SetupSavedCardBody;
}): ApiResponse<SetupSavedCardResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/billing/payment-method/setup-intent",
    jwt,
    body,
    schemas: {
      body: SetupSavedCardBodySchema,
      response: SetupSavedCardResponseSchema,
    },
  });
}
