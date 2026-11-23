import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { customerHasSnapshot } from "../../instagram/snapshots/customerHasSnapshot.js";
import {
  LATEST_TERMS_OF_SERVICE_RELEASE_DATE,
  LATEST_PRIVACY_POLICY_RELEASE_DATE,
} from "../../../constants/platform/TERMS.js";
import type { SupportedLocale } from "@tagly/models/shared";
import type { CustomerMeInput } from "@tagly/models/v2/customerApp";

/**
 * Builds the lean `CustomerMe` DTO for `GET /v2/customers/me`. One Prisma read,
 * no aggregates — the heavier slices (statistics,
 * referrals, future earnings) live on their own sub-resources. Returns the Zod
 * *input* shape (raw `Date` / `BigInt`); the core scalar schemas coerce these
 * to their wire form (ISO strings / safe-integer cents) on the SDK boundary.
 */
export async function hydrateCustomerMe(
  customerId: number,
): Promise<CustomerMeInput> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      uid: true,
      fullName: true,
      email: true,
      locale: true,
      gender: true,
      genderUpdatedAt: true,
      estimatedStoryViews: true,
      createdAt: true,
      status: true,
      promoNotificationsEnabled: true,
      interestsUpdatedAt: true,
      agreedToTermsOfServiceAt: true,
      agreedToPrivacyPolicyAt: true,
      sensitiveData: {
        select: {
          balanceUsdCents: true,
          lockedBalanceUsdCents: true,
          multiplierBps: true,
          payoutsEnabledAt: true,
          stripeConnectId: true,
        },
      },
      instagram: {
        select: {
          // For the ban-list lookup below — NOT spread onto the wire DTO.
          instagramUid: true,
          username: true,
          name: true,
          pfpUrl: true,
          followerCount: true,
          accountType: true,
        },
      },
      interests: {
        select: {
          id: true,
          slug: true,
          sortOrder: true,
          verticals: { select: { id: true } },
        },
      },
      // Only the code's change timestamp (settings cooldown gate); the code +
      // referral stats live on GET /me/referrals.
      accountReferral: {
        select: { codeUpdatedAt: true },
      },
    },
  });

  if (!customer) {
    throw createCustomError(4043, "Customer not found", 404);
  }

  // `hasSnapshot` lives on the IG account, so only resolve it when one is linked.
  // Same existence check the reward pricer gates `NO_SNAPSHOT` on — keeps the
  // flag and the estimates in lockstep. Fields are picked explicitly so the
  // ban-lookup-only `instagramUid` never reaches the wire.
  const igRow = customer.instagram;
  const instagram = igRow
    ? {
        username: igRow.username,
        name: igRow.name,
        pfpUrl: igRow.pfpUrl,
        followerCount: igRow.followerCount,
        accountType: igRow.accountType,
        hasSnapshot: await customerHasSnapshot(customerId),
      }
    : null;

  // A banned customer's reason lives on the persistent IG ban-list, not on the
  // customer row. Matched by the row's `customerUid` audit pointer OR the
  // currently-linked IG — the pointer leg is what keeps the reason visible
  // after the customer disconnects or switches Instagram (the relation is
  // deletable; keying on it alone rendered a reason-less banner, E059).
  // Degrade to null on any miss/error — a session hydrator must never throw
  // on a read (see hydrators/CLAUDE.md), and `banReason` is purely informational.
  let banReason: string | null = null;
  if (customer.status === "BANNED") {
    const banned = await prisma.bannedInstagram
      .findFirst({
        where: {
          OR: [
            { customerUid: customer.uid },
            ...(igRow?.instagramUid
              ? [{ instagramUid: igRow.instagramUid }]
              : []),
          ],
        },
        select: { reason: true },
      })
      .catch(() => null);
    banReason = banned?.reason ?? null;
  }

  return {
    uid: customer.uid,
    fullName: customer.fullName,
    email: customer.email,
    // locale is validated at the write boundary (the registration controller
    // narrows it via validateLocaleIsSupportedOrThrow before persisting), so the
    // stored value is guaranteed supported — read it as-is. No read-time
    // re-validation: it can't fail, and a throwing check would brick the user
    // (see ../CLAUDE.md).
    locale: customer.locale as SupportedLocale,
    gender: customer.gender,
    genderUpdatedAt: customer.genderUpdatedAt,
    estimatedStoryViews: customer.estimatedStoryViews,
    createdAt: customer.createdAt,
    status: customer.status,
    banReason,
    promoNotificationsEnabled: customer.promoNotificationsEnabled,
    sensitiveData: customer.sensitiveData,
    instagram,
    interests: customer.interests,
    interestsUpdatedAt: customer.interestsUpdatedAt,
    referralCodeUpdatedAt: customer.accountReferral.codeUpdatedAt,
    shouldAgreeWithLatestTos:
      customer.agreedToTermsOfServiceAt < LATEST_TERMS_OF_SERVICE_RELEASE_DATE,
    shouldAgreeWithLatestPrivacyPolicy:
      customer.agreedToPrivacyPolicyAt < LATEST_PRIVACY_POLICY_RELEASE_DATE,
  };
}
