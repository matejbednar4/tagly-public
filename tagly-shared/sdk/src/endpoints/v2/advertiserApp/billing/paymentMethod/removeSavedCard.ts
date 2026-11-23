import {
  RemoveSavedCardResponse,
  RemoveSavedCardResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `DELETE /v2/advertisers/me/billing/payment-method`. Unlink the saved
 * off-session card — this turns BOTH pay-as-you-go and the monthly budget
 * off. Authed (JWT).
 */
export function removeSavedCard({
  jwt,
}: {
  jwt: string;
}): ApiResponse<RemoveSavedCardResponse | ApiError> {
  return request({
    method: "DELETE",
    path: "/v2/advertisers/me/billing/payment-method",
    jwt,
    schemas: { response: RemoveSavedCardResponseSchema },
  });
}
