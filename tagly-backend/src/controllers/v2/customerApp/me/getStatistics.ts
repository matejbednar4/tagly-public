import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { hydrateCustomerStatistics } from "../../../../utils/hydrators/customers/hydrateCustomerStatistics.js";

/**
 * `GET /v2/customers/me/statistics` — the logged-in customer's lifetime sharing
 * statistics. Pure read; carries Zod-input values (bigint cents) coerced on the
 * wire, so it isn't annotated with the output response type.
 */
export const getStatistics: RequestHandler = asyncHandler(async (req, res) => {
  const statistics = await hydrateCustomerStatistics(req.user.id);

  res.status(200).json({ statistics });
});
