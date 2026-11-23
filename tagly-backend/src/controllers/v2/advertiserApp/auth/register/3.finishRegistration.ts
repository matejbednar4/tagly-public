import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { createAdvertiserWithUniqueUid } from "../../../../../utils/advertisers/createAdvertiserWithUniqueUid.js";
import { validateLocaleIsSupportedOrThrow } from "../../../../../utils/localization/validateLocaleIsSupportedOrThrow.js";
import { validateLanguageIsSupportedOrThrow } from "../../../../../utils/localization/validateLanguageIsSupportedOrThrow.js";
import { issueSessionJwt } from "../../../../../utils/auth/issueSessionJwt.js";
import type {
  FinishRegistrationBody,
  FinishRegistrationResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/public/auth/advertisers/finish-registration` — promote the
 * PendingAdvertiserAccount to an Advertiser. Returns a session JWT (HTTP 201).
 *
 * Unlike the customer's complete-registration this is **not** the final
 * onboarding step and carries no profile/IG data — it creates the bare account
 * (no `entity`/business setup, which happens afterwards on the authenticated
 * account). All it needs is a verified pending account (`emailVerified`).
 *
 * Steps: resolve any referrer code → create the Advertiser (unique UID + own
 * referral code + sensitive data via the shared util) → migrate pending push
 * tokens + OAuth identities to the new account → delete the pending row → seed
 * notification defaults. The marketing floor lives here: an unanswered
 * `promoNotificationsEnabled` (null) promotes to `false` (opted out).
 */
export const finishRegistration: RequestHandler = asyncHandler(
  async (req, res) => {
    const { registrationToken } = req.validatedBody as FinishRegistrationBody;

    const pending = await prisma.pendingAdvertiserAccount.findUnique({
      where: { registrationToken, emailVerified: true },
    });
    if (!pending) {
      throw createCustomError(
        2313,
        "Pending account not found or email not verified",
        404,
      );
    }

    let accountReferralId: number | null = null;
    if (pending.referrerCode) {
      const referrer = await prisma.accountReferral.findFirst({
        where: { code: pending.referrerCode, status: "ACTIVE" },
        select: { id: true },
      });
      if (referrer) accountReferralId = referrer.id;
    }

    const created = await prisma.$transaction(async (tx) => {
      const advertiser = await createAdvertiserWithUniqueUid(tx, {
        email: pending.email,
        entity: pending.entity, // null at this stage — business setup follows
        accountReferralId,
        promoNotificationsEnabled: pending.promoNotificationsEnabled ?? false,
        locale: validateLocaleIsSupportedOrThrow(pending.locale),
        language: validateLanguageIsSupportedOrThrow(pending.language),
        agreedToTosAt: pending.agreedToTermsOfServiceAt ?? new Date(),
        agreedToPPAt: pending.agreedToPrivacyPolicyAt ?? new Date(),
      });

      // Migrate pending push tokens + OAuth identities to the Advertiser.
      await tx.pushToken.updateMany({
        where: { pendingAdvertiserId: pending.id },
        data: { advertiserId: advertiser.id, pendingAdvertiserId: null },
      });
      await tx.oAuthIdentity.updateMany({
        where: { pendingAdvertiserId: pending.id },
        data: { advertiserId: advertiser.id, pendingAdvertiserId: null },
      });

      const del = await tx.pendingAdvertiserAccount.deleteMany({
        where: { id: pending.id },
      });
      if (del.count !== 1) {
        throw createCustomError(1202, "No pending account found", 404);
      }

      return advertiser;
    });

    res.status(201).json({
      jwt: issueSessionJwt(created),
    } satisfies FinishRegistrationResponse);
  },
);
