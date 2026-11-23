import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { startOrResendOtpSession } from "../../../../../utils/auth/otp/startOrResendOtpSession.js";
import type { StartDeleteAccountResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/delete-account/start` — begin account deletion by
 * sending an `ACCOUNT_DELETION` OTP to the advertiser's current email. Deleting a
 * password-less account is irreversible, so we verify the advertiser still
 * controls their email (a stolen session alone must not be able to erase the
 * account).
 *
 * Idempotent: `swallowRecentlySent` means re-entering the flow (or the client's
 * resend) just proceeds — the per-session cooldown + the client countdown gate
 * abuse. Confirmation (verify + forfeit + delete) is `/confirm`.
 */
export const startDeleteAccount: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;

    const advertiser = await prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: { email: true },
    });
    if (!advertiser) {
      throw createCustomError(1304, "advertiser not found", 404);
    }

    await startOrResendOtpSession({
      purpose: "ACCOUNT_DELETION",
      targetEmail: advertiser.email,
      subject: { kind: "advertiser", advertiserId },
      swallowRecentlySent: true,
    });

    res.status(200).json({
      message: "Verification code sent",
    } satisfies StartDeleteAccountResponse);
  },
);
