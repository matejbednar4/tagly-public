import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { assertTextAllowedOrThrow } from "../../../../../utils/moderation/assertTextAllowedOrThrow.js";
import type {
  SaveProfileBody,
  SaveProfileResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/save-profile` — persist name, gender, and
 * interests onto the verified PendingCustomer.
 */
export const saveProfile: RequestHandler = asyncHandler(async (req, res) => {
  const { registrationToken, fullName, gender, interestSlugs } =
    req.validatedBody as SaveProfileBody;

  // The name is shown to advertisers (share rating) and admins — same 4951
  // profanity gate as advertiser-authored business text.
  assertTextAllowedOrThrow(fullName, "Name", "fullName");

  const pending = await prisma.pendingCustomer.findUnique({
    where: { registrationToken, emailVerified: true },
    select: { id: true },
  });
  if (!pending) {
    throw createCustomError(2222, "Pending registration not found", 404);
  }

  await prisma.pendingCustomer.update({
    where: { id: pending.id },
    data: {
      fullName,
      gender,
      // `Interest.slug` is unique — connect directly by slug (DB is seeded from
      // the same @tagly/models catalog the client picks from).
      interests: { set: interestSlugs.map((slug) => ({ slug })) },
    },
  });

  res
    .status(200)
    .json({ message: "Profile saved" } satisfies SaveProfileResponse);
});
