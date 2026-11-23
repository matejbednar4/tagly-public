import { createCustomError } from "../core/errors/createCustomError.js";
import { AdvertiserEntity, Prisma } from "../../generated/prisma/client.js";
import { generateUid } from "../core/uids/generateUid.js";
import { generateReferralCode } from "../core/uids/generateReferralCode.js";
import { MAX_UID_COLLISION_RETRIES } from "../../constants/auth/UID_COLLISION.js";
import type {
  SupportedLocale,
  SupportedLanguage,
} from "@tagly/models/shared";

/**
 * Advertiser creation. Advertisers are passwordless (OTP / Google / Apple
 * sign-in — there is no advertiser password table). Unique UID + fresh referral
 * code, retrying on the rare collision. Must run inside a transaction.
 */
export async function createAdvertiserWithUniqueUid(
  tx: Prisma.TransactionClient,
  args: {
    email: string;
    entity: AdvertiserEntity | null;
    accountReferralId?: number | null;
    promoNotificationsEnabled: boolean;
    locale: SupportedLocale;
    language: SupportedLanguage;
    agreedToTosAt: Date;
    agreedToPPAt: Date;
  },
) {
  for (let attempt = 0; attempt < MAX_UID_COLLISION_RETRIES; attempt++) {
    const uid = generateUid("ADVERTISER");
    try {
      return await tx.advertiser.create({
        data: {
          uid,
          email: args.email,
          promoNotificationsEnabled: args.promoNotificationsEnabled,
          locale: args.locale,
          language: args.language,
          sensitiveData: { create: {} },
          entity: args.entity,
          agreedToTermsOfServiceAt: args.agreedToTosAt,
          agreedToPrivacyPolicyAt: args.agreedToPPAt,
          accountReferral: {
            create: {
              code: generateReferralCode("ADVERTISER"),
              referredEvent: args.accountReferralId
                ? { create: { referrerCodeId: args.accountReferralId } }
                : undefined,
            },
          },
        },
        select: { id: true, jwtVersion: true, uid: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        Array.isArray(err.meta?.target) &&
        ((err.meta!.target as string[]).includes("code") ||
          (err.meta!.target as string[]).includes("uid"))
      ) {
        continue; // regenerate referral code / UID
      }
      throw err;
    }
  }
  throw createCustomError(5201, "Failed to create advertiser", 500);
}
