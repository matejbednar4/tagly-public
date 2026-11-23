import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { startOrResendOtpSession } from "../../../../../utils/auth/otp/startOrResendOtpSession.js";
import type {
  ResendOtpBody,
  ResendOtpResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/public/auth/advertisers/resend-otp` — resend the email OTP for an
 * in-progress advertiser login or registration (rate-limited inside the OTP
 * util). Replies the same whether or not an account exists, to avoid email
 * enumeration.
 */
export const resendOtp: RequestHandler = asyncHandler(async (req, res) => {
  const { email } = req.validatedBody as ResendOtpBody;

  const advertiser = await prisma.advertiser.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (advertiser) {
    await startOrResendOtpSession({
      purpose: "LOGIN",
      targetEmail: advertiser.email,
      subject: { kind: "advertiser", advertiserId: advertiser.id },
      // Explicit resend: surface "recently sent" so the user gets "please wait".
      swallowRecentlySent: false,
    });
    res.status(200).json({ message: "OTP resent" } satisfies ResendOtpResponse);
    return;
  }

  const pending = await prisma.pendingAdvertiserAccount.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (pending) {
    await startOrResendOtpSession({
      purpose: "REGISTRATION",
      targetEmail: pending.email,
      subject: { kind: "pendingAdvertiser", pendingAdvertiserId: pending.id },
      swallowRecentlySent: false,
    });
  }

  res.status(200).json({ message: "OTP resent" } satisfies ResendOtpResponse);
});
