import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { closePaygPeriod } from "../../../../../utils/money/payg/closePaygPeriod.js";
import { bumpAdvertiserBudgetGen } from "../../../../../utils/pricing/rewardEstCache.js";
import type { DisablePaygResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `DELETE /v2/advertisers/me/billing/payg` — turn pay-as-you-go off while
 * KEEPING the saved card (period closed `DISABLED`). The keep-card
 * counterpart of `removePaygCard`: with the card shared by the monthly
 * budget, "stop PAYG" and "remove my card" are two different actions, and
 * the app asks which one the advertiser means when the other feature is on.
 *
 * In-flight PAYG shares are left as-is — settlement still charges the card
 * for them (the card is on file; only new shares stop accruing on PAYG).
 * Error 1353 when no PAYG period is open.
 */
export const disablePayg: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;

  const closed = await closePaygPeriod(advertiserId, "DISABLED");
  if (closed === 0) {
    throw createCustomError(1353, "Pay-as-you-go is not active", 400);
  }

  // PAYG just went inactive → this advertiser's estimates may now be
  // budget-capped. No ledger event fired, so bump the estimate cache
  // explicitly. Fire-and-forget, fail-open.
  void bumpAdvertiserBudgetGen(advertiserId).catch(() => {});

  res.status(200).json({ active: false } satisfies DisablePaygResponse);
});
