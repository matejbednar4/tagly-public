import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { verifyOtpForSessionOrThrow } from "../../../../../utils/auth/otp/verifyOtpForSessionOrThrow.js";
import { issueSessionJwt } from "../../../../../utils/auth/issueSessionJwt.js";
import { getAdvertiserRegistrationResumeState } from "../../../../../utils/auth/getAdvertiserRegistrationResumeState.js";
import { envVariables } from "../../../../../environment/envVariables.js";
import type {
  VerifyOtpBody,
  VerifyOtpResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/public/auth/advertisers/verify-otp` — verify the emailed OTP for
 * advertiser login or registration. No consent fields: ToS/Privacy were stamped
 * at start-email, marketing is its own step.
 *
 *  - login → session JWT
 *  - registration → flips `emailVerified`, returns the registrationToken + the
 *    advertiser resume state (locale + marketingConsentResolved)
 */
export const verifyOtp: RequestHandler = asyncHandler(async (req, res) => {
  const { email, otp } = req.validatedBody as VerifyOtpBody;

  const advertiser = await prisma.advertiser.findUnique({
    where: { email },
    select: {
      id: true,
      uid: true,
      jwtVersion: true,
      otpSessions: {
        where: { purpose: "LOGIN" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      },
    },
  });

  // Store-review tester bypass: the one configured tester logs in with a fixed
  // OTP (reviewers can't receive the emailed code). Only matches the exact
  // tester email + OTP, and only for an existing Advertiser.
  const isTester =
    !!envVariables.TESTER_EMAIL &&
    !!envVariables.TESTER_OTP &&
    email === envVariables.TESTER_EMAIL.toLowerCase() &&
    otp === envVariables.TESTER_OTP;
  if (isTester && advertiser) {
    res.status(200).json({
      type: "login",
      jwt: issueSessionJwt(advertiser),
    } satisfies VerifyOtpResponse);
    return;
  }

  if (advertiser && advertiser.otpSessions.length > 0) {
    await verifyOtpForSessionOrThrow({
      code: otp,
      expectedPurpose: "LOGIN",
      otpSessionId: advertiser.otpSessions[0].id,
    });
    res.status(200).json({
      type: "login",
      jwt: issueSessionJwt(advertiser),
    } satisfies VerifyOtpResponse);
    return;
  }

  const pending = await prisma.pendingAdvertiserAccount.findUnique({
    where: { email },
    include: { otpSession: true },
  });
  if (!pending || !pending.otpSession) {
    throw createCustomError(2311, "No account found for this email", 404);
  }

  await verifyOtpForSessionOrThrow({
    code: otp,
    expectedPurpose: "REGISTRATION",
    otpSessionId: pending.otpSession.id,
  });
  await prisma.pendingAdvertiserAccount.update({
    where: { id: pending.id },
    data: { emailVerified: true },
  });

  // Carry the resume state so a mid-onboarding pending login skips steps it
  // already finished (marketing consent).
  res.status(200).json({
    type: "registration",
    registrationToken: pending.registrationToken,
    ...getAdvertiserRegistrationResumeState(pending),
  } satisfies VerifyOtpResponse);
});
