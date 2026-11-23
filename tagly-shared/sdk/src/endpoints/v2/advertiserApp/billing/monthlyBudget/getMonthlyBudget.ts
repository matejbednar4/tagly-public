import {
  GetMonthlyBudgetResponse,
  GetMonthlyBudgetResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `GET /v2/advertisers/me/billing/monthly-budget`. The full monthly-budget
 * state backing the MonthlyBudgetSheet (status, target, next charge, retry,
 * last end reason, card on file). Authed (JWT).
 */
export function getMonthlyBudget({
  jwt,
}: {
  jwt: string;
}): ApiResponse<GetMonthlyBudgetResponse | ApiError> {
  return request({
    method: "GET",
    path: "/v2/advertisers/me/billing/monthly-budget",
    jwt,
    schemas: { response: GetMonthlyBudgetResponseSchema },
  });
}
