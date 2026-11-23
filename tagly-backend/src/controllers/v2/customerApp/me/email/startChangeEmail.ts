import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { startOrResendOtpSession } from "../../../../../utils/auth/otp/startOrResendOtpSession.js";
import type {
  StartChangeEmailBody,
  StartChangeEmailResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/email/start-change` — begin a dual-OTP email change.
 * Sends a code to the customer's CURRENT email (`EMAIL_CHANGE_CURRENT`) and to the
 * NEW email (`EMAIL_CHANGE_NEW`). Both swallow "recently sent", so re-entering the
 * flow (or the client's resend) just proceeds — the per-session cooldown + the
 * client-side countdown gate abuse.
 *
 * Rejects a new email that is the same as the current one (1103) or already
 * registered to another account (1102). Verifying the *current* email too is the
 * point: customers are password-less, so the email is the sole account anchor —
 * a stolen session alone must not be able to move it.
 */
export const startChangeEmail: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { newEmail } = req.validatedBody as StartChangeEmailBody;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });
    if (!customer) {
      throw createCustomError(1002, "customer not found", 404);
    }

    if (customer.email.toLowerCase() === newEmail.toLowerCase()) {
      throw createCustomError(
        1103,
        "new email is the same as the current one",
        409,
      );
    }

    const taken = await prisma.customer.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (taken) {
      throw createCustomError(1102, "email already registered", 409);
    }

    // Send a code to BOTH the current and new email. Re-targeting to a different
    // new email while the previous code is still within its cooldown surfaces the
    // "sent recently" cooldown (the OTP util keeps target + code consistent and
    // won't swallow it on a target change), so no stale code can slip through.
    await startOrResendOtpSession({
      purpose: "EMAIL_CHANGE_CURRENT",
      targetEmail: customer.email,
      subject: { kind: "customer", customerId },
      swallowRecentlySent: true,
    });
    await startOrResendOtpSession({
      purpose: "EMAIL_CHANGE_NEW",
      targetEmail: newEmail,
      subject: { kind: "customer", customerId },
      swallowRecentlySent: true,
    });

    res
      .status(200)
      .json({ message: "Verification codes sent" } satisfies StartChangeEmailResponse);
  },
);
