import {
  RemovePaygCardResponse,
  RemovePaygCardResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `DELETE /v2/advertisers/me/billing/payg/payment-method`. Unlink the
 * PAYG card and close the open period (PAYG turns off). Authed (JWT).
 *
 * @deprecated Back-compat only — the app now unlinks with `removeSavedCard`
 * (`DELETE /billing/payment-method`). Delete once pre-2026-09 builds roll off.
 */
export function removePaygCard({
  jwt,
}: {
  jwt: string;
}): ApiResponse<RemovePaygCardResponse | ApiError> {
  return request({
    method: "DELETE",
    path: "/v2/advertisers/me/billing/payg/payment-method",
    jwt,
    schemas: { response: RemovePaygCardResponseSchema },
  });
}
