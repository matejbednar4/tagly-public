import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { removeSavedCard } from "../../../../../utils/money/savedCard/removeSavedCard.js";
import { bumpAdvertiserBudgetGen } from "../../../../../utils/pricing/rewardEstCache.js";
import type { RemovePaygCardResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `DELETE /v2/advertisers/me/billing/payg/payment-method` — the legacy URL
 * for unlinking the saved card. Identical effect to
 * `paymentMethod/removeSavedCard` (closes BOTH feature periods, detaches at
 * Stripe); only the shipped response shape (`{ active }`) differs.
 *
 * @deprecated back-compat: only app builds shipped before 2026-09 call this.
 * Current builds use `DELETE /billing/payment-method`. Delete this
 * controller, its route, and its model/SDK entries once those builds roll
 * off.
 */
export const removePaygCard: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;
  const { closedPayg } = await removeSavedCard(advertiserId);
  if (closedPayg) void bumpAdvertiserBudgetGen(advertiserId).catch(() => {});
  res.status(200).json({ active: false } satisfies RemovePaygCardResponse);
});
