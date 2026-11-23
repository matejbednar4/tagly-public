import prisma from "../../../prisma/prisma.js";
import { sendOTPEmail } from "../../email/sendOTPEmail.js";
import {
  createCustomError,
  isCustomError,
} from "../../core/errors/createCustomError.js";
import generateNumericOtpAndHash from "./generateOtp.js";
import { resendOtpForSession } from "./resendOtpForSession.js";
import { OtpPurpose, Prisma } from "../../../generated/prisma/client.js";
import { ERROR_CODES } from "@tagly/models/shared";
import { resolveOtpSubjectLanguage } from "./resolveOtpSubjectLanguage.js";

/**
 * Subject entity that the OTP session belongs to.
 * Used to link the session to the correct account type.
 */
export type OtpSubject =
  | { kind: "pendingCustomer"; pendingCustomerId: number }
  | { kind: "customer"; customerId: number }
  | { kind: "pendingAdvertiser"; pendingAdvertiserId: number }
  | { kind: "advertiser"; advertiserId: number };

/**
 * Starts a new OTP session or resends an existing one.
 *
 * If a session already exists for the subject/purpose/email combination,
 * it resends the OTP for that session (respecting rate limits in resendOtpForSession).
 * Otherwise, creates a new session with a fresh OTP and sends it via email.
 *
 * The OTP is hashed with bcrypt before storage. Expiration and attempt limits
 * are configured via tunables.
 *
 * `swallowRecentlySent`: when true, a "recently sent" rate-limit on an existing
 * session is treated as success (returns normally) instead of throwing. Used by
 * `start-email`, where a valid OTP already being out there means the caller's
 * goal is met — the client should proceed to the OTP screen. Explicit `resend`
 * leaves this off so the user gets "please wait" feedback.
 */
export async function startOrResendOtpSession(opts: {
  purpose: OtpPurpose;
  targetEmail: string;
  subject: OtpSubject;
  swallowRecentlySent: boolean;
}) {
  const lowerCaseEmail = opts.targetEmail.trim().toLowerCase();
  const now = new Date();

  // Build where clause for the unique constraint (purpose + subject ID).
  // Note: We do NOT include targetEmail here because the unique constraint
  // is only on (purpose, subjectId). If the user's email changed, we still
  // want to find and update the existing session rather than fail on create.
  const where: Prisma.OtpSessionWhereInput = {
    purpose: opts.purpose,
  };

  if (opts.subject.kind === "pendingCustomer") {
    where.pendingCustomerId = opts.subject.pendingCustomerId;
  } else if (opts.subject.kind === "customer") {
    where.customerId = opts.subject.customerId;
  } else if (opts.subject.kind === "pendingAdvertiser") {
    where.pendingAdvertiserId = opts.subject.pendingAdvertiserId;
  } else if (opts.subject.kind === "advertiser") {
    where.advertiserId = opts.subject.advertiserId;
  }

  const existing = await prisma.otpSession.findFirst({
    where,
    select: { id: true, targetEmail: true },
  });

  if (existing) {
    // Re-point the target (if it changed) as part of the resend, not before it —
    // `resendOtpForSession` updates the email together with the fresh code, and
    // its rate-limit checks throw *before* any write, so a stale code for the old
    // address can never authorize a switch to a new one.
    const targetChanged = existing.targetEmail.toLowerCase() !== lowerCaseEmail;
    try {
      await resendOtpForSession({
        otpSessionId: existing.id,
        newTargetEmail: targetChanged ? lowerCaseEmail : undefined,
      });
    } catch (err) {
      // For start-email, "recently sent" is success — a valid OTP is already out
      // there, so let the caller respond 200 and the client proceed to the OTP
      // screen. But NEVER swallow it on a target change: the existing code was
      // sent to the *old* address, so the caller must surface the cooldown rather
      // than silently keep the wrong target. resendOtpForSession still throws (and
      // the explicit resend endpoint still surfaces it) — only this swallow path
      // is opt-in, and only when the target is unchanged.
      if (
        opts.swallowRecentlySent &&
        !targetChanged &&
        isCustomError(err) &&
        err.error.code === ERROR_CODES.SERVER.OTP.SENT_RECENTLY
      ) {
        return;
      }
      throw err;
    }
    return;
  }

  const { otp, otpHash, otpExpiresAt } = await generateNumericOtpAndHash();

  const data: Prisma.OtpSessionCreateInput = {
    purpose: opts.purpose,
    targetEmail: lowerCaseEmail,
    otpHash,
    otpExpiresAt,
    attempts: 0,
    resendCount: 0,
    lastSentAt: now,
  };

  if (opts.subject.kind === "pendingCustomer") {
    data.pendingCustomer = {
      connect: { id: opts.subject.pendingCustomerId },
    };
  } else if (opts.subject.kind === "customer") {
    data.customer = {
      connect: { id: opts.subject.customerId },
    };
  } else if (opts.subject.kind === "pendingAdvertiser") {
    data.pendingAdvertiser = {
      connect: { id: opts.subject.pendingAdvertiserId },
    };
  } else if (opts.subject.kind === "advertiser") {
    data.advertiser = {
      connect: { id: opts.subject.advertiserId },
    };
  }

  try {
    await prisma.otpSession.create({ data });
  } catch (err) {
    // Generic client message; the real Prisma cause rides to the tracker via
    // `cause` (never leaked to the client).
    throw createCustomError(
      ERROR_CODES.SERVER.OTP.FAILED_TO_CREATE,
      "Failed to create OTP session",
      { status: 500, cause: err },
    );
  }

  const lang = await resolveOtpSubjectLanguage(opts.subject);
  await sendOTPEmail(lowerCaseEmail, otp, lang);
}
