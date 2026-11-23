import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import type {
  UpdateLanguageBody,
  UpdateLanguageResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/update/language` — set the logged-in advertiser's
 * preferred language (`en` | `cs`), used for server-sent copy (transactional
 * push + email).
 *
 * The in-app display language is a separate device-local preference; this only
 * governs what the backend renders. The body schema already narrows `language`
 * to a `SupportedLanguage`, so no re-validation is needed here. No cooldown.
 */
export const updateLanguage: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;
  const { language } = req.validatedBody as UpdateLanguageBody;

  const updated = await prisma.advertiser.updateMany({
    where: { id: advertiserId },
    data: { language },
  });
  if (updated.count === 0) {
    throw createCustomError(1304, "advertiser not found", 404);
  }

  res.status(200).json({ language } satisfies UpdateLanguageResponse);
});
