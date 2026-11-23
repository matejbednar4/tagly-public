import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { generateSecureToken } from "../../../../../utils/core/uids/generateSecureToken.js";
import { startOrResendOtpSession } from "../../../../../utils/auth/otp/startOrResendOtpSession.js";
import { validateLocaleIsSupportedOrThrow } from "../../../../../utils/localization/validateLocaleIsSupportedOrThrow.js";
import { validateLanguageIsSupportedOrThrow } from "../../../../../utils/localization/validateLanguageIsSupportedOrThrow.js";
import type {
  StartEmailBody,
  StartEmailResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/start-email` — unified email entry (login +
 * registration), emitting an OTP either way.
 *
 * ToS/Privacy are accepted **passively** on the sign-in screen, so a brand-new
 * PendingCustomer is stamped with both timestamps at creation here (v3 deferred
 * that to verify-otp). Marketing is left untouched — it's client-owned (US sends
 * true via save-marketing-consent, EU via the post-OTP screen).
 */
export const startEmail: RequestHandler = asyncHandler(async (req, res) => {
  const {
    email,
    locale: rawLocale,
    language: rawLanguage,
  } = req.validatedBody as StartEmailBody;

  const locale = validateLocaleIsSupportedOrThrow(rawLocale);
  const language = validateLanguageIsSupportedOrThrow(rawLanguage);

  // Existing registered customer → login OTP.
  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (customer) {
    await startOrResendOtpSession({
      purpose: "LOGIN",
      targetEmail: customer.email,
      subject: { kind: "customer", customerId: customer.id },
      // "Recently sent" is fine here — a valid OTP already exists, so respond 200
      // and let the client proceed to the OTP screen rather than erroring.
      swallowRecentlySent: true,
    });
    res.status(200).json({
      message: "OTP sent",
      email,
    } satisfies StartEmailResponse);
    return;
  }

  // Existing pending account (mid-registration) → refresh locale/language, resend.
  const pending = await prisma.pendingCustomer.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (pending) {
    await prisma.pendingCustomer.update({
      where: { id: pending.id },
      data: { locale, language },
    });
    await startOrResendOtpSession({
      purpose: "REGISTRATION",
      targetEmail: pending.email,
      subject: { kind: "pendingCustomer", pendingCustomerId: pending.id },
      swallowRecentlySent: true,
    });
    res.status(200).json({
      message: "OTP sent",
      email,
    } satisfies StartEmailResponse);
    return;
  }

  // New user → minimal pending account with ToS/Privacy stamped (passive).
  const registrationToken = generateSecureToken();
  const now = new Date();
  const created = await prisma.pendingCustomer.create({
    data: {
      email,
      registrationToken,
      locale,
      language,
      agreedToTermsOfServiceAt: now,
      agreedToPrivacyPolicyAt: now,
    },
    select: { id: true, email: true },
  });
  await startOrResendOtpSession({
    purpose: "REGISTRATION",
    targetEmail: created.email,
    subject: { kind: "pendingCustomer", pendingCustomerId: created.id },
    // A brand-new session can't be rate-limited, but start-email always treats
    // "recently sent" as success for consistency.
    swallowRecentlySent: true,
  });
  res.status(200).json({
    message: "OTP sent",
    email,
  } satisfies StartEmailResponse);
});
