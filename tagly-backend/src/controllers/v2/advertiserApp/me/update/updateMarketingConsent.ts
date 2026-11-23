import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import type { UpdateMarketingConsentBody } from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/update/marketing-consent` — set the logged-in
 * advertiser's marketing opt-in. The single `promoNotificationsEnabled` flag
 * gates BOTH promo channels (email + push), so this is the in-app opt-out Apple
 * Guideline 4.5.4 requires. No cooldown. Transactional notifications are
 * unaffected.
 */
export const updateMarketingConsent: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { promoNotificationsEnabled } =
      req.validatedBody as UpdateMarketingConsentBody;

    const updated = await prisma.advertiser.updateMany({
      where: { id: advertiserId },
      data: { promoNotificationsEnabled },
    });
    if (updated.count === 0) {
      throw createCustomError(1304, "advertiser not found", 404);
    }

    res.status(200).json({ promoNotificationsEnabled });
  },
);
