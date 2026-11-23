import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { startOrResendOtpSession } from "../../../../../utils/auth/otp/startOrResendOtpSession.js";
import type {
  ResendOtpBody,
  ResendOtpResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/resend-otp` — resend the email OTP for an
 * in-progress login or registration (rate-limited inside the OTP util). Replies
 * the same whether or not an account exists, to avoid email enumeration.
 */
export const resendOtp: RequestHandler = asyncHandler(async (req, res) => {
  const { email } = req.validatedBody as ResendOtpBody;

  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (customer) {
    await startOrResendOtpSession({
      purpose: "LOGIN",
      targetEmail: customer.email,
      subject: { kind: "customer", customerId: customer.id },
      // Explicit resend: surface "recently sent" so the user gets "please wait".
      swallowRecentlySent: false,
    });
    res.status(200).json({ message: "OTP resent" } satisfies ResendOtpResponse);
    return;
  }

  const pending = await prisma.pendingCustomer.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (pending) {
    await startOrResendOtpSession({
      purpose: "REGISTRATION",
      targetEmail: pending.email,
      subject: { kind: "pendingCustomer", pendingCustomerId: pending.id },
      swallowRecentlySent: false,
    });
  }

  res.status(200).json({ message: "OTP resent" } satisfies ResendOtpResponse);
});
