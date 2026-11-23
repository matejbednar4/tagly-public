import prisma from "../../../prisma/prisma.js";
import { OtpPurpose } from "../../../generated/prisma/client.js";
import { generateLongCodeAndHash } from "./generateOtp.js";
import { sendOTPEmail } from "../../email/sendOTPEmail.js";

/**
 * Creates (or replaces) the admin's LOGIN OTP session with a fresh 64-hex code
 * and emails it. Admin tooling is English-only, so the code always goes out in
 * `"en"`.
 *
 * Deliberately simpler than the customer/advertiser `startOrResendOtpSession`:
 * **no resend rate-limit dance** — every admin login just upserts a new code
 * (login itself is IP-rate-limited via `authIpLimiter`). Admin resend UX is out
 * of scope. Upsert keys on the `@@unique([purpose, adminId])` constraint, so an
 * admin never accumulates more than one live LOGIN session.
 */
export async function createAdminLoginOtpSessionAndSendEmail(opts: {
  adminId: number;
  targetEmail: string;
}): Promise<void> {
  const lowerCaseEmail = opts.targetEmail.trim().toLowerCase();
  const { otp, otpHash, otpExpiresAt } = await generateLongCodeAndHash();

  await prisma.otpSession.upsert({
    where: {
      otpPurposeAdminId: { purpose: OtpPurpose.LOGIN, adminId: opts.adminId },
    },
    update: {
      targetEmail: lowerCaseEmail,
      otpHash,
      otpExpiresAt,
      attempts: 0,
      resendCount: 0,
      lastSentAt: new Date(),
    },
    create: {
      purpose: OtpPurpose.LOGIN,
      targetEmail: lowerCaseEmail,
      otpHash,
      otpExpiresAt,
      admin: { connect: { id: opts.adminId } },
    },
  });

  // Admin tooling has no language column — always English.
  await sendOTPEmail(lowerCaseEmail, otp, "en");
}
