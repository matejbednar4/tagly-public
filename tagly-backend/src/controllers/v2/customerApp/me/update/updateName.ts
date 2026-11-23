import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { assertTextAllowedOrThrow } from "../../../../../utils/moderation/assertTextAllowedOrThrow.js";
import type {
  UpdateNameBody,
  UpdateNameResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/update/name` — update the logged-in customer's display
 * name. The body schema already trims + enforces non-empty, so this is a plain
 * atomic write. No cooldown on the name.
 */
export const updateName: RequestHandler = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const { fullName } = req.validatedBody as UpdateNameBody;

  // The name is shown to advertisers (share rating) and admins — same 4951
  // profanity gate as advertiser-authored business text.
  assertTextAllowedOrThrow(fullName, "Name", "fullName");

  const result = await prisma.customer.updateMany({
    where: { id: customerId },
    data: { fullName },
  });

  if (result.count === 0) {
    throw createCustomError(1711, "customer not found", 404);
  }

  res.status(200).json({ fullName } satisfies UpdateNameResponse);
});
