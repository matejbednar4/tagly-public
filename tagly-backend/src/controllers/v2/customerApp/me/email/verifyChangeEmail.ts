import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { verifyOtpForSessionOrThrow } from "../../../../../utils/auth/otp/verifyOtpForSessionOrThrow.js";
import { queueNotificationJobs } from "../../../../../utils/queue/queueNotificationJobs.js";
import type {
  VerifyChangeEmailBody,
  VerifyChangeEmailResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/email/verify-change` — finish the dual-OTP email change.
 * Verifies the current-inbox code and the new-inbox code, then atomically checks
 * the new email is still free, swaps it, and deletes both OTP sessions. Emails the
 * OLD address a security notice so the owner sees the change. Requires a prior
 * `start-change` (both sessions present, else 1100).
 */
export const verifyChangeEmail: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { currentOtp, newOtp } = req.validatedBody as VerifyChangeEmailBody;

    const currentSession = await prisma.otpSession.findFirst({
      where: { customerId, purpose: "EMAIL_CHANGE_CURRENT" },
      select: { id: true },
    });
    const newSession = await prisma.otpSession.findFirst({
      where: { customerId, purpose: "EMAIL_CHANGE_NEW" },
      select: { id: true, targetEmail: true },
    });
    if (!currentSession || !newSession) {
      throw createCustomError(1100, "no pending email change", 400);
    }

    // Verify BOTH codes without consuming either — a single wrong code must not
    // delete the other's session (which would force a restart). Only once both
    // pass do we swap the email and delete the sessions together.
    await verifyOtpForSessionOrThrow({
      code: currentOtp,
      expectedPurpose: "EMAIL_CHANGE_CURRENT",
      otpSessionId: currentSession.id,
      deleteOnSuccess: false,
    });
    await verifyOtpForSessionOrThrow({
      code: newOtp,
      expectedPurpose: "EMAIL_CHANGE_NEW",
      otpSessionId: newSession.id,
      deleteOnSuccess: false,
    });

    const newEmail = newSession.targetEmail;

    const { email, oldEmail } = await prisma.$transaction(async (tx) => {
      const taken = await tx.customer.findUnique({
        where: { email: newEmail },
        select: { id: true },
      });
      if (taken && taken.id !== customerId) {
        throw createCustomError(1102, "email already registered", 409);
      }

      const before = await tx.customer.findUnique({
        where: { id: customerId },
        select: { email: true },
      });

      const updated = await tx.customer.update({
        where: { id: customerId },
        data: { email: newEmail },
        select: { email: true },
      });

      // Wipe ALL of this customer's OTP sessions — the two email-change ones and
      // any other pending OTP (e.g. a stale LOGIN code that was sent to the OLD
      // address). The old email must not be able to drive any further OTP.
      await tx.otpSession.deleteMany({ where: { customerId } });

      return { email: updated.email, oldEmail: before?.email ?? null };
    });

    // Security notice to the OLD address (best-effort; the helper never throws).
    if (oldEmail) {
      await queueNotificationJobs({
        customerIds: [customerId],
        eventSlug: "c.security.email-change",
        overwriteEmail: oldEmail,
      });
    }

    res.status(200).json({ newEmail: email } satisfies VerifyChangeEmailResponse);
  },
);
