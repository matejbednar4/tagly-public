import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { retrieveAvailableStripeBalance } from "../../../../utils/money/stripe/retrieveAvailableStripeBalance.js";
import type { AdminGetStripeBalanceResponse } from "@tagly/models/v2/adminApp";

/**
 * `GET /v2/admin/balance/stripe` — the live platform Stripe balance split into
 * assigned/unassigned buckets (advertiser credits, customer rewards,
 * subsidized-share locks, and the free remainder). All the aggregation lives
 * in the permanent util `retrieveAvailableStripeBalance` (Stripe API + DB sums). Read-only,
 * SUPER-gated in the router. Not cached — every call reflects Stripe "now".
 */
export const getStripeBalance: RequestHandler = asyncHandler(
  async (_req, res) => {
    const balance = await retrieveAvailableStripeBalance();

    res.status(200).json({
      message: "Balance retrieved successfully",
      ...balance,
    } satisfies AdminGetStripeBalanceResponse);
  },
);
