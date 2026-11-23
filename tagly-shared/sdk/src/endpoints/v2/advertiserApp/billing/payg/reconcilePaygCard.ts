import {
  ReconcilePaygCardBody,
  ReconcilePaygCardBodySchema,
  ReconcilePaygCardResponse,
  ReconcilePaygCardResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `POST /v2/advertisers/me/billing/payg/reconcile`. After the
 * PaymentSheet confirms the PAYG SetupIntent, link the saved card immediately
 * (idempotent with the `setup_intent.succeeded` webhook). Authed (JWT).
 *
 * @deprecated Back-compat only — the app now reconciles with
 * `reconcileSavedCard`. Delete once pre-2026-09 builds roll off.
 */
export function reconcilePaygCard({
  jwt,
  body,
}: {
  jwt: string;
  body: ReconcilePaygCardBody;
}): ApiResponse<ReconcilePaygCardResponse | ApiError> {
  return request({
    method: "POST",
    path: "/v2/advertisers/me/billing/payg/reconcile",
    jwt,
    body,
    schemas: {
      body: ReconcilePaygCardBodySchema,
      response: ReconcilePaygCardResponseSchema,
    },
  });
}
