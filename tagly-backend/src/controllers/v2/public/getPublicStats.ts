import type { RequestHandler } from "express";
import type { GetPublicStatsResponse } from "@tagly/models/v2/crossApp";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import { businessVisibleWhere } from "../../../utils/businesses/businessAccessibility.js";
import prisma from "../../../prisma/prisma.js";

/**
 * v2 — `GET /v2/public/stats`. Public marketing counters (total customer
 * count + visible business-page count) for landing surfaces — the join page
 * renders "Join X people already on Tagly" from this, and the marketing
 * site's landing hero renders its social-proof chips from both counters.
 * Unauthenticated + IP-rate-limited.
 *
 * Deliberately uncached: both consumers cache this fetch for 5 minutes in
 * Next's data cache, the IP limiter bounds direct hits, and COUNTs at our
 * table sizes are sub-millisecond. Revisit (Redis read-through per the house
 * rules) only if the tables grow to the point where COUNT is slow AND a
 * client starts calling this per app-open.
 *
 * `customerCount` counts every customer row — deletion is a hard delete, so
 * rows are live accounts; BANNED customers are a negligible rounding error
 * for a marketing counter. `businessCount` counts business pages a customer
 * could currently see in the app (`businessVisibleWhere`, i.e. ACTIVE —
 * unfunded pages still exist publicly, so they count; DELETED/BANNED never
 * do).
 */
export const getPublicStats: RequestHandler = asyncHandler(async (_req, res) => {
  const [customerCount, businessCount] = await Promise.all([
    prisma.customer.count(),
    prisma.localSubaccount.count({ where: businessVisibleWhere }),
  ]);

  res.status(200).json({
    message: "Stats fetched",
    customerCount,
    businessCount,
  } satisfies GetPublicStatsResponse);
});
