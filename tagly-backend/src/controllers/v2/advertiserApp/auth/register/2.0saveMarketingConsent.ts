import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import type {
  SaveMarketingConsentBody,
  SaveMarketingConsentResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/public/auth/advertisers/save-marketing-consent` — persist the promo
 * opt-in onto the PendingAdvertiserAccount. A dumb write: the client decides
 * whether/when to call it (the consent screen is shown to every locale). Left unanswered,
 * it resolves to opted-out at promotion.
 */
export const saveMarketingConsent: RequestHandler = asyncHandler(
  async (req, res) => {
    const { registrationToken, promoNotificationsEnabled } =
      req.validatedBody as SaveMarketingConsentBody;

    const pending = await prisma.pendingAdvertiserAccount.findUnique({
      where: { registrationToken, emailVerified: true },
      select: { id: true },
    });
    if (!pending) {
      throw createCustomError(2321, "Pending registration not found", 404);
    }

    await prisma.pendingAdvertiserAccount.update({
      where: { id: pending.id },
      data: { promoNotificationsEnabled },
    });

    res.status(200).json({
      message: "Marketing preference saved",
    } satisfies SaveMarketingConsentResponse);
  },
);
