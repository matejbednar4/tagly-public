import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import type { ShareUidParams } from "@tagly/models/v2/advertiserApp";
import { ADMIN_APPROVED_SHARE_WHERE } from "../../../../utils/shares/shareAccess.js";
import hydrateAdvertiserShareDetails from "../../../../utils/hydrators/shares/hydrateAdvertiserShareDetails.js";

/**
 * `GET /v2/advertisers/shares/:uid` — one of the advertiser's shares by UID
 * (deep-linkable detail screen). Ownership + visibility guarded: a share that
 * isn't the advertiser's, or isn't APPROVED (PENDING/REJECTED are invisible to
 * them), is treated as not found so its existence never leaks. Pure read.
 * Returns `AdvertiserShareDetails` (preview + insights + paidAt).
 */
export const getShareByUid: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;
  const { uid } = req.validatedParams as ShareUidParams;

  const share = await prisma.share.findFirst({
    where: { uid, advertiserId, ...ADMIN_APPROVED_SHARE_WHERE },
    select: { id: true },
  });
  if (!share) {
    throw createCustomError(
      4042,
      "Share not found or does not belong to your advertiser",
      404
    );
  }

  const hydrated = await hydrateAdvertiserShareDetails({ shareId: share.id });
  if (!hydrated) {
    throw createCustomError(4042, "Share not found", 404);
  }

  res.status(200).json({ share: hydrated });
});
