import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { hydrateAdvertiserReferrals } from "../../../../utils/hydrators/advertisers/hydrateAdvertiserReferrals.js";

/**
 * `GET /v2/advertisers/me/referrals` — the logged-in advertiser's referral
 * code, status, referrer, referred counts, and lifetime referral earnings.
 * Pure read; carries Zod-input values (Date / bigint) coerced on the wire, so
 * it isn't annotated with the output response type.
 */
export const getReferrals: RequestHandler = asyncHandler(async (req, res) => {
  const referrals = await hydrateAdvertiserReferrals(req.user.id);

  res.status(200).json({ referrals });
});
