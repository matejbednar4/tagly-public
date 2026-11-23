import {
  ReconcileSavedCardBody,
  ReconcileSavedCardBodySchema,
  ReconcileSavedCardResponse,
  ReconcileSavedCardResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/billing/payment-method/reconcile`. After the
 * PaymentSheet confirms a `card_setup` SetupIntent, save the card immediately
 * (idempotent with the `setup_intent.succeeded` webhook). Card only — no
 * feature period is opened. Authed (JWT).
 */
export function reconcileSavedCard({
  jwt,
  body,
}: {
  jwt: string;
  body: ReconcileSavedCardBody;
}): ApiResponse<ReconcileSavedCardResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/billing/payment-method/reconcile",
    jwt,
    body,
    schemas: {
      body: ReconcileSavedCardBodySchema,
      response: ReconcileSavedCardResponseSchema,
    },
  });
}
