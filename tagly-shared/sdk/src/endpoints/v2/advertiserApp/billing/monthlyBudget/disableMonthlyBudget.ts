import {
  DisableMonthlyBudgetResponse,
  DisableMonthlyBudgetResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `DELETE /v2/advertisers/me/billing/monthly-budget`. Turn the monthly
 * budget off; the saved card (and PAYG, if on) is untouched. Authed (JWT).
 */
export function disableMonthlyBudget({
  jwt,
}: {
  jwt: string;
}): ApiResponse<DisableMonthlyBudgetResponse | ApiError> {
  return request({
    method: "DELETE",
    path: "/v2/advertisers/me/billing/monthly-budget",
    jwt,
    schemas: { response: DisableMonthlyBudgetResponseSchema },
  });
}
