import {
  SetMonthlyBudgetBody,
  SetMonthlyBudgetBodySchema,
  SetMonthlyBudgetResponse,
  SetMonthlyBudgetResponseSchema,
} from "@tagly/models/v2/advertiserApp";
import { ApiResponse, request } from "../../../../../client/request";
import { ApiError } from "@tagly/models/shared";

/**
 * v2 — `PUT /v2/advertisers/me/billing/monthly-budget`. Enable the monthly
 * budget at a target (or change an active one's target). Only opens the
 * period — the stripe worker charges on its next tick, so poll
 * `getMonthlyBudget` for the outcome. Requires a saved card (1350
 * otherwise). Authed (JWT).
 */
export function setMonthlyBudget({
  jwt,
  body,
}: {
  jwt: string;
  body: SetMonthlyBudgetBody;
}): ApiResponse<SetMonthlyBudgetResponse | ApiError> {
  return request({
    method: "PUT",
    path: "/v2/advertisers/me/billing/monthly-budget",
    jwt,
    body,
    schemas: {
      body: SetMonthlyBudgetBodySchema,
      response: SetMonthlyBudgetResponseSchema,
    },
  });
}
