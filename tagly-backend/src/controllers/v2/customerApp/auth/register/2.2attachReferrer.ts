import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import type {
  AttachReferrerBody,
  AttachReferrerResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/attach-referrer` — store a referrer code on
 * the verified PendingCustomer. Called only when the user arrived via a referral
 * (deeplink), after the client has a registrationToken.
 *
 * A dumb write: the code is stored raw and resolved into the actual referral at
 * complete-registration (which silently ignores an unknown/inactive code). Last
 * write wins — the pending isn't attributed until completion, so overwriting a
 * not-yet-resolved code is safe. Kept separate from save-profile so referral
 * attribution isn't coupled to the profile form.
 */
export const attachReferrer: RequestHandler = asyncHandler(async (req, res) => {
  const { registrationToken, referrerCode } =
    req.validatedBody as AttachReferrerBody;

  const pending = await prisma.pendingCustomer.findUnique({
    where: { registrationToken, emailVerified: true },
    select: { id: true },
  });
  if (!pending) {
    throw createCustomError(2223, "Pending registration not found", 404);
  }

  await prisma.pendingCustomer.update({
    where: { id: pending.id },
    data: { referrerCode },
  });

  res
    .status(200)
    .json({ message: "Referrer attached" } satisfies AttachReferrerResponse);
});
