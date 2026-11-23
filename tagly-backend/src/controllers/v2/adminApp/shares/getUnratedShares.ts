import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { ADMIN_REVIEW } from "../../../../constants/platform/ADMIN_REVIEW.js";
import { ADMIN_ASSESSABLE_SHARE_WHERE } from "../../../../utils/shares/shareAccess.js";
import adminHydrateShare from "../../../../utils/hydrators/admin/adminHydrateShare.js";

/**
 * `GET /v2/admin/shares/unrated` — APPROVED subsidized shares never rated or
 * reported, oldest first with the full outstanding total. Subsidized
 * businesses have no advertiser, so admins rate their shares in that role via
 * `POST /v2/admin/shares/:uid/assess`.
 *
 * Subsidized = `fundingModeAtCreation` (the canonical immutable signal), never
 * `advertiserId`. Unassessed = `ratedAt IS NULL` (the canonical gate — a
 * reported share never resurfaces here). Deliberately NOT filtered by payout
 * `status`: rating measures post quality and feeds the customer's rolling
 * multiplier, so a PAID or UNPAYABLE share is still worth rating.
 */
export const getUnratedShares: RequestHandler = asyncHandler(
  async (_req, res) => {
    const where = ADMIN_ASSESSABLE_SHARE_WHERE;

    const [idRows, total] = await Promise.all([
      prisma.share.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: ADMIN_REVIEW.QUEUE_PAGE_SIZE,
        select: { id: true },
      }),
      prisma.share.count({ where }),
    ]);

    // The hydrator preserves input order, so the FIFO order carries through.
    const shares = await adminHydrateShare({
      shareIds: idRows.map((r) => r.id),
    });

    res.status(200).json({
      message: "Unrated subsidized shares fetched successfully",
      shares,
      total,
    });
  }
);
