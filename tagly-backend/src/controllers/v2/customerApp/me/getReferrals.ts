import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { hydrateCustomerReferrals } from "../../../../utils/hydrators/customers/hydrateCustomerReferrals.js";

/**
 * `GET /v2/customers/me/referrals` — the logged-in customer's referral code,
 * status, referrer, referred counts, and lifetime referral earnings. Pure read;
 * carries Zod-input values (Date / bigint) coerced on the wire, so it isn't
 * annotated with the output response type.
 */
export const getReferrals: RequestHandler = asyncHandler(async (req, res) => {
  const referrals = await hydrateCustomerReferrals(req.user.id);

  res.status(200).json({ referrals });
});
