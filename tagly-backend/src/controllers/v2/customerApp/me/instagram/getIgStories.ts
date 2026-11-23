import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { getUnsharedLiveStories } from "../../../../../utils/instagram/userMedia/getUnsharedLiveStories.js";
import type { GetIgStoriesResponse } from "@tagly/models/v2/customerApp";

/**
 * `GET /v2/customers/me/instagram/stories` — the logged-in customer's currently
 * live Instagram stories that are still eligible for a new share (the only media
 * type v2 shares support).
 *
 * `getUnsharedLiveStories` decrypts/refreshes the IG token — surfacing the
 * DISCONNECTED / EXPIRED_TOKEN states via codes 5007/5008/5009/5110 — fetches the
 * live list, and drops any story already shared in the last 24h so the
 * share-create grid never offers an already-monetized one.
 *
 * Stories are inherently 9:16; the wire carries no dimensions (the client knows
 * the aspect ratio and measures exact width/height at share creation).
 */
export const getIgStories: RequestHandler = asyncHandler(async (req, res) => {
  const stories = await getUnsharedLiveStories(req.user.id);

  res.status(200).json({
    message: "Stories fetched successfully",
    stories,
  } satisfies GetIgStoriesResponse);
});
