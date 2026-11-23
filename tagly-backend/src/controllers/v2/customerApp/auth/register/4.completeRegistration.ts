import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { Gender } from "../../../../../generated/prisma/client.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { envVariables } from "../../../../../environment/envVariables.js";
import { exchangeIGCodeForToken } from "../../../../../utils/instagram/tokens/exchangeIGCodeForToken.js";
import { getUserDataFromIG } from "../../../../../utils/instagram/accountInsights/getUserDataFromIg.js";
import { getAndEncryptIgLongLivedToken } from "../../../../../utils/instagram/tokens/getAndEncryptIgLLT.js";
import { createCustomerWithUniqueUid } from "../../../../../utils/customers/createCustomerWithUniqueUid.js";
import { validateLocaleIsSupportedOrThrow } from "../../../../../utils/localization/validateLocaleIsSupportedOrThrow.js";
import { validateLanguageIsSupportedOrThrow } from "../../../../../utils/localization/validateLanguageIsSupportedOrThrow.js";
import { issueSessionJwt } from "../../../../../utils/auth/issueSessionJwt.js";
import type {
  CompleteRegistrationBody,
  CompleteRegistrationResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/complete-registration` — promote the
 * PendingCustomer to a Customer (the final onboarding step). Returns a session
 * JWT (HTTP 201).
 *
 * Instagram is optional. If a `code` is provided, exchange it and link the IG
 * account to the new Customer. If that IG already belongs to another Customer,
 * we **reject** with 2214 — connecting an IG during registration must never
 * become an implicit login into someone else's account. The client surfaces
 * this and offers the dedicated `instagram-login` recovery (a re-auth, the only
 * IG-based login path). With no `code`, the Customer is created without IG
 * (monetization gated in-app until connected).
 *
 * The marketing floor lives here: an unanswered `promoNotificationsEnabled`
 * (null) promotes to `false` (opted out).
 */
export const completeRegistration: RequestHandler = asyncHandler(
  async (req, res) => {
    const { code, registrationToken } =
      req.validatedBody as CompleteRegistrationBody;

    // If linking Instagram, exchange the code and fetch the IG profile first.
    // Reject early if that IG already belongs to another Customer: connecting an
    // IG during registration must never become an implicit login into someone
    // else's account. The client surfaces this and offers the dedicated
    // `instagram-login` recovery (a re-auth — the only IG-based login path).
    let igUserData: Awaited<ReturnType<typeof getUserDataFromIG>> | null = null;
    let shortLivedToken: string | null = null;
    if (code) {
      shortLivedToken = await exchangeIGCodeForToken(code);
      igUserData = await getUserDataFromIG(shortLivedToken);

      const existingCustomer = await prisma.customer.findFirst({
        where: { instagram: { instagramUid: igUserData.id } },
        select: { id: true },
      });
      if (existingCustomer) {
        throw createCustomError(
          2214,
          "This Instagram account is already registered to another Tagly account",
          409,
        );
      }
    }

    const pending = await prisma.pendingCustomer.findUnique({
      where: {
        registrationToken,
        emailVerified: true,
        fullName: { not: null }, // profile step must be done
      },
      include: { interests: { select: { id: true } } },
    });
    if (!pending) {
      throw createCustomError(
        2213,
        "Pending account not found or profile not complete",
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

    // Long-lived IG token: only fetched once we know we're creating (pending is
    // valid and the IG isn't an existing Customer) — avoids a wasted IG call.
    let igEncrypted: { encryptedToken: string; expiresAt: Date } | null = null;
    if (code && shortLivedToken) {
      igEncrypted = await getAndEncryptIgLongLivedToken(shortLivedToken);
    }

    const created = await prisma.$transaction(async (tx) => {
      let instagramDbId: number | null = null;
      if (igUserData && igEncrypted) {
        const igAccount = await tx.customerInstagramAccount.create({
          data: {
            instagramUid: igUserData.id,
            username: igUserData.username,
            followerCount: igUserData.followers_count,
            accountType: igUserData.account_type,
            pfpUrl: igUserData.profile_picture_url ?? null,
            name: igUserData.name ?? null,
            instagramToken: {
              create: {
                accessTokenEnc: igEncrypted.encryptedToken,
                expiresAt: igEncrypted.expiresAt,
              },
            },
          },
          select: { id: true },
        });
        instagramDbId = igAccount.id;
      }

      const customer = await createCustomerWithUniqueUid(tx, {
        email: pending.email,
        fullName: pending.fullName!, // guaranteed by the where clause
        gender: pending.gender ?? Gender.UNSPECIFIED,
        locale: validateLocaleIsSupportedOrThrow(pending.locale),
        language: validateLanguageIsSupportedOrThrow(pending.language),
        interestIds: pending.interests.map((i) => i.id),
        instagramDbId,
        accountReferralId,
        agreedToTermsOfServiceAt:
          pending.agreedToTermsOfServiceAt ?? new Date(),
        agreedToPrivacyPolicyAt: pending.agreedToPrivacyPolicyAt ?? new Date(),
        promoNotificationsEnabled: pending.promoNotificationsEnabled ?? false,
      });

      // Migrate pending push tokens + OAuth identities to the Customer.
      await tx.pushToken.updateMany({
        where: { pendingCustomerId: pending.id },
        data: { customerId: customer.id, pendingCustomerId: null },
      });
      await tx.oAuthIdentity.updateMany({
        where: { pendingCustomerId: pending.id },
        data: { customerId: customer.id, pendingCustomerId: null },
      });

      const del = await tx.pendingCustomer.deleteMany({
        where: { id: pending.id },
      });
      if (del.count !== 1) {
        throw createCustomError(1202, "No pending account found", 404);
      }

      return customer;
    });

    res.status(201).json({
      jwt: issueSessionJwt(created),
    } satisfies CompleteRegistrationResponse);
  },
);
