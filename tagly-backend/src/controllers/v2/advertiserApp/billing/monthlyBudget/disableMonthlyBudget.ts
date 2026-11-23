import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { closeMonthlyBudgetPeriod } from "../../../../../utils/money/monthlyBudget/closeMonthlyBudgetPeriod.js";
import type { DisableMonthlyBudgetResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `DELETE /v2/advertisers/me/billing/monthly-budget` — turn the monthly
 * budget off (period closed `DISABLED`). The saved card stays on file and
 * pay-as-you-go, if on, keeps running; removing the card outright is
 * `removePaygCard`, which stops both. Error 1351 when nothing is active.
 */
export const disableMonthlyBudget: RequestHandler = asyncHandler(
  async (req, res) => {
    const closed = await closeMonthlyBudgetPeriod(req.user.id, "DISABLED");
    if (closed === 0) {
      throw createCustomError(1351, "The monthly budget is not active", 400);
    }
    res
      .status(200)
      .json({ active: false } satisfies DisableMonthlyBudgetResponse);
  },
);
