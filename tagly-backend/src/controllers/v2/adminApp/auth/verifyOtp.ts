import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { verifyOtpForSessionOrThrow } from "../../../../utils/auth/otp/verifyOtpForSessionOrThrow.js";
import { issueSessionJwt } from "../../../../utils/auth/issueSessionJwt.js";
import { ADMIN } from "../../../../constants/platform/ADMIN.js";
import { ERROR_CODES } from "@tagly/models/shared";
import type {
  AdminVerifyOtpBody,
  AdminVerifyOtpResponse,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/public/auth/admin/verify` — step 2 of admin login.
 *
 * Resolves the admin's LOGIN OTP session **by email** (the mobile-safe
 * equivalent of the origin's same-device cookie, matching the customer flow),
 * verifies the long code (`verifyOtpForSessionOrThrow` handles expiry, attempts,
 * bcrypt compare, and single-use deletion), and returns the admin-capability
 * session **JWT in the body** (bearer; v2 is cookie-free).
 *
 * `isActive` is re-checked here and again on every authed request in `verifyJwt`,
 * so deactivating an admin invalidates an in-flight verify and all live tokens.
 */
export const verifyOtp: RequestHandler = asyncHandler(async (req, res) => {
  const { email, code } = req.validatedBody as AdminVerifyOtpBody;
  const normalizedEmail = email.trim().toLowerCase();

  const admin = await prisma.admin.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      uid: true,
      isActive: true,
      jwtVersion: true,
      otpSessions: {
        where: { purpose: "LOGIN" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      },
    },
  });

  // No admin / inactive / no live LOGIN session → generic invalid-code error
  // (don't distinguish the cases — no enumeration through the verify step).
  if (!admin || !admin.isActive || admin.otpSessions.length === 0) {
    throw createCustomError(
      ERROR_CODES.SERVER.OTP.SESSION_NOT_FOUND,
      "Invalid or expired verification code",
      404,
    );
  }

  await verifyOtpForSessionOrThrow({
    code,
    expectedPurpose: "LOGIN",
    otpSessionId: admin.otpSessions[0].id,
  });

  res.status(200).json({
    // Admin sessions are deliberately 1h, NOT the shared 14-day customer window.
    jwt: issueSessionJwt(admin, { expiresIn: ADMIN.TOKEN_EXPIRY }),
  } satisfies AdminVerifyOtpResponse);
});
