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
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/public/auth/advertisers/start-email` — unified email entry (login +
 * registration) for the advertiser, emitting an OTP either way. Twin of the
 * customer `start-email`.
 *
 * ToS/Privacy are accepted **passively** on the sign-in screen, so a brand-new
 * PendingAdvertiserAccount is stamped with both timestamps at creation here.
 * Marketing is left untouched — it's client-owned (recorded for every locale
 * via save-marketing-consent from the post-OTP consent screen).
 */
export const startEmail: RequestHandler = asyncHandler(async (req, res) => {
  const {
    email,
    locale: rawLocale,
    language: rawLanguage,
  } = req.validatedBody as StartEmailBody;

  const locale = validateLocaleIsSupportedOrThrow(rawLocale);
  const language = validateLanguageIsSupportedOrThrow(rawLanguage);

  // Existing registered advertiser → login OTP.
  const advertiser = await prisma.advertiser.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (advertiser) {
    await startOrResendOtpSession({
      purpose: "LOGIN",
      targetEmail: advertiser.email,
      subject: { kind: "advertiser", advertiserId: advertiser.id },
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
  const pending = await prisma.pendingAdvertiserAccount.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (pending) {
    await prisma.pendingAdvertiserAccount.update({
      where: { id: pending.id },
      data: { locale, language },
    });
    await startOrResendOtpSession({
      purpose: "REGISTRATION",
      targetEmail: pending.email,
      subject: { kind: "pendingAdvertiser", pendingAdvertiserId: pending.id },
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
  const created = await prisma.pendingAdvertiserAccount.create({
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
    subject: { kind: "pendingAdvertiser", pendingAdvertiserId: created.id },
    // A brand-new session can't be rate-limited, but start-email always treats
    // "recently sent" as success for consistency.
    swallowRecentlySent: true,
  });
  res.status(200).json({
    message: "OTP sent",
    email,
  } satisfies StartEmailResponse);
});
