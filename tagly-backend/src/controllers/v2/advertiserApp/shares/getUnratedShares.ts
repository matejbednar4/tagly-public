import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { ADVERTISER_SHARES } from "../../../../constants/content/ADVERTISER_SHARES.js";
import { ADVERTISER_ASSESSABLE_SHARE_WHERE } from "../../../../utils/shares/shareAccess.js";
import hydrateAdvertiserSharePreviews from "../../../../utils/hydrators/shares/hydrateAdvertiserSharePreviews.js";

/**
 * `GET /v2/advertisers/shares/unrated` — the advertiser's oldest still-unrated
 * shares (the "shares to rate" home strip) plus the full outstanding count.
 *
 * "Unrated" = APPROVED, has a customer, and never rated or reported
 * (`ratedAt` null — reporting stamps it, so a reported share drops out). Ordered
 * oldest-first so the longest-waiting shares are surfaced for rating first.
 * Returns a small fixed page (`ADVERTISER_SHARES.UNRATED_STRIP_SIZE`); the count
 * is the total so the client can badge "N to rate".
 */
export const getUnratedShares: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;

    // Compose the canonical assessable predicate (approved + unassessed + has a
    // customer) + the advertiser's ownership scope. Same rule the per-share
    // `shouldAssessShare` flag is derived from, so the list and the flag agree.
    const where = {
      advertiserId,
      ...ADVERTISER_ASSESSABLE_SHARE_WHERE,
    };

    const [idRows, totalUnratedCount] = await Promise.all([
      prisma.share.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: ADVERTISER_SHARES.UNRATED_STRIP_SIZE,
        select: { id: true },
      }),
      prisma.share.count({ where }),
    ]);

    const shares =
      idRows.length === 0
        ? []
        : await hydrateAdvertiserSharePreviews({
            shareIds: idRows.map((r) => r.id),
          });

    res.status(200).json({
      message: "Unrated shares fetched successfully",
      shares,
      totalUnratedCount,
    });
  }
);
