import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import type {
  AttachReferrerBody,
  AttachReferrerResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/public/auth/advertisers/attach-referrer` — store a referrer code on
 * the verified PendingAdvertiserAccount. Called only when the advertiser arrived
 * via a referral (deeplink), after the client has a registrationToken.
 *
 * A dumb write: the code is stored raw and resolved into the actual referral at
 * complete-registration (which silently ignores an unknown/inactive code). Last
 * write wins — the pending isn't attributed until completion, so overwriting a
 * not-yet-resolved code is safe. Kept separate from business setup so referral
 * attribution isn't coupled to it.
 */
export const attachReferrer: RequestHandler = asyncHandler(async (req, res) => {
  const { registrationToken, referrerCode } =
    req.validatedBody as AttachReferrerBody;

  const pending = await prisma.pendingAdvertiserAccount.findUnique({
    where: { registrationToken, emailVerified: true },
    select: { id: true },
  });
  if (!pending) {
    throw createCustomError(2323, "Pending registration not found", 404);
  }

  await prisma.pendingAdvertiserAccount.update({
    where: { id: pending.id },
    data: { referrerCode },
  });

  res
    .status(200)
    .json({ message: "Referrer attached" } satisfies AttachReferrerResponse);
});
