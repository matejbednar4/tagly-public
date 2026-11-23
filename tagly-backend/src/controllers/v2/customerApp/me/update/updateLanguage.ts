import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import type {
  UpdateLanguageBody,
  UpdateLanguageResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/update/language` — set the logged-in customer's preferred
 * language (`en` | `cs`), used for server-sent copy (transactional push + email).
 *
 * The in-app display language is a separate device-local preference; this only
 * governs what the backend renders. The body schema already narrows `language` to
 * a `SupportedLanguage`, so no re-validation is needed here. No cooldown — users
 * can switch as often as they like.
 */
export const updateLanguage: RequestHandler = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const { language } = req.validatedBody as UpdateLanguageBody;

  const updated = await prisma.customer.updateMany({
    where: { id: customerId },
    data: { language },
  });
  if (updated.count === 0) {
    throw createCustomError(1711, "customer not found", 404);
  }

  res.status(200).json({ language } satisfies UpdateLanguageResponse);
});
