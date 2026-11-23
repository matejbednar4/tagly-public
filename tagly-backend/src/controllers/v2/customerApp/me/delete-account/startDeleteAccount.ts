import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { startOrResendOtpSession } from "../../../../../utils/auth/otp/startOrResendOtpSession.js";
import type { StartDeleteAccountResponse } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/delete-account/start` — begin account deletion by
 * sending an `ACCOUNT_DELETION` OTP to the customer's current email. Deleting a
 * password-less account is irreversible, so we verify the customer still controls
 * their email (a stolen session alone must not be able to erase the account).
 *
 * Idempotent: `swallowRecentlySent` means re-entering the flow (or the client's
 * resend) just proceeds — the per-session cooldown + the client countdown gate
 * abuse. Confirmation (verify + sweep + delete) is `/confirm`.
 */
export const startDeleteAccount: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });
    if (!customer) {
      throw createCustomError(1002, "customer not found", 404);
    }

    await startOrResendOtpSession({
      purpose: "ACCOUNT_DELETION",
      targetEmail: customer.email,
      subject: { kind: "customer", customerId },
      swallowRecentlySent: true,
    });

    res.status(200).json({
      message: "Verification code sent",
    } satisfies StartDeleteAccountResponse);
  },
);
