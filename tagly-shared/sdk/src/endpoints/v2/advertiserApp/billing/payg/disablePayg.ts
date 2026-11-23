import {
  DisablePaygResponse,
  DisablePaygResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `DELETE /v2/advertisers/me/billing/payg`. Turn pay-as-you-go off while
 * keeping the saved card on file (so an active monthly budget keeps running).
 * Authed (JWT).
 */
export function disablePayg({
  jwt,
}: {
  jwt: string;
}): ApiResponse<DisablePaygResponse | ApiError> {
  return request({
    method: "DELETE",
    path: "/v2/advertisers/me/billing/payg",
    jwt,
    schemas: { response: DisablePaygResponseSchema },
  });
}
