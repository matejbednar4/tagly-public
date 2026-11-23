import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../../prisma/prisma.js";
import { bumpCustomerRewardEstGen } from "../../../../../utils/pricing/rewardEstCache.js";
import type { UpdateEstimatedStoryViewsBody } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/update/estimated-story-views` — set (or clear with
 * null) the customer's self-reported "typical story views".
 *
 * This is the SERVER-OWNED reach fallback the v2 estimate pricer reads for
 * customers with no usable Instagram data (E062). Because estimates are priced
 * from this stored value (never from a request param), the reward-estimate
 * cache stays valid across it: any change here bumps the customer's reward-est
 * generation, which re-keys every cached estimate for them. An unchanged value
 * is a no-op (no write, no bump) so redundant client syncs can't churn the
 * cache. No cooldown — it's a self-estimate, not gameable state (the pricer
 * ignores it entirely once a real snapshot exists, and no-IG customers cannot
 * create shares, so it only ever moves the aspirational display number).
 */
export const updateEstimatedStoryViews: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { estimatedStoryViews } =
      req.validatedBody as UpdateEstimatedStoryViewsBody;

    // Read-compare-write (NOT a `NOT: { field }` filter — SQL `NOT (col = x)`
    // never matches NULL rows, which would silently skip the first-ever set).
    // No-op when unchanged, so redundant client syncs can't churn the cache.
    const current = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { estimatedStoryViews: true },
    });

    if (current && current.estimatedStoryViews !== estimatedStoryViews) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { estimatedStoryViews },
      });
      // The estimate input moved — invalidate this customer's cached estimates.
      await bumpCustomerRewardEstGen(customerId);
    }

    res.status(200).json({ estimatedStoryViews });
  },
);
