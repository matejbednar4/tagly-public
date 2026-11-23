import { ERROR_CODES } from "@tagly/models/shared";
import { OTP } from "../../../constants/auth/OTP.js";
import prisma from "../../../prisma/prisma.js";
import { sendOTPEmail } from "../../email/sendOTPEmail.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import generateNumericOtpAndHash from "./generateOtp.js";
import { resolveOtpSessionLanguage } from "./resolveOtpSubjectLanguage.js";

export async function resendOtpForSession({
  otpSessionId,
  newTargetEmail,
}: {
  otpSessionId: number;
  /**
   * Re-point the session at a new email as part of this send. Updated together
   * with the fresh OTP hash (and only when a send actually happens) — the
   * rate-limit / max-resend checks throw *before* any mutation, so the target can
   * never move ahead of the code (a code mailed to the old address must never end
   * up authorizing the new one).
   */
  newTargetEmail?: string;
}) {
  const now = new Date();

  const session = await prisma.otpSession.findUnique({
    where: { id: otpSessionId },
  });

  // OTP-resend failures (not-found / cooldown / max-resends) are TRACKED — they
  // signal onboarding friction (people unable to get a code).
  if (!session) {
    throw createCustomError(
      ERROR_CODES.SERVER.OTP.SESSION_NOT_FOUND,
      "OTP session not found",
      404
    );
  }

  if (session.resendCount >= OTP.MAX_RESENDS_PER_SESSION) {
    throw createCustomError(
      ERROR_CODES.SERVER.OTP.MAX_RESENDS,
      "Too many OTP sends",
      429
    );
  }

  if (session.lastSentAt) {
    const diff = now.getTime() - session.lastSentAt.getTime();
    if (diff < OTP.MIN_RESEND_INTERVAL_MS) {
      throw createCustomError(
        ERROR_CODES.SERVER.OTP.SENT_RECENTLY,
        "OTP recently sent",
        429
      );
    }
  }

  const { otp, otpHash, otpExpiresAt } = await generateNumericOtpAndHash();
  const targetEmail = newTargetEmail ?? session.targetEmail;

  await prisma.otpSession.update({
    where: { id: otpSessionId },
    data: {
      otpHash,
      otpExpiresAt,
      lastSentAt: now,
      attempts: 0,
      resendCount: session.resendCount + 1,
      // Re-point the target only alongside the new code, so the two never diverge.
      ...(newTargetEmail ? { targetEmail: newTargetEmail } : {}),
    },
  });

  const lang = await resolveOtpSessionLanguage(session);
  await sendOTPEmail(targetEmail, otp, lang);
}
