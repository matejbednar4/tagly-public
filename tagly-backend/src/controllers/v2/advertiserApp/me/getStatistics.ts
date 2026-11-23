import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { hydrateAdvertiserStatistics } from "../../../../utils/hydrators/advertisers/hydrateAdvertiserStatistics.js";

/**
 * `GET /v2/advertisers/me/statistics` — the logged-in advertiser's lifetime
 * statistics (over APPROVED shares). Pure read; carries Zod-input values
 * (bigint cents) coerced on the wire, so it isn't annotated with the output
 * response type.
 */
export const getStatistics: RequestHandler = asyncHandler(async (req, res) => {
  const statistics = await hydrateAdvertiserStatistics(req.user.id);

  res.status(200).json({ statistics });
});
