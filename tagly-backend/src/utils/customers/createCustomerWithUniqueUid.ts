import { Gender, Prisma } from "../../generated/prisma/client.js";
import { generateUid } from "../core/uids/generateUid.js";
import { generateReferralCode } from "../core/uids/generateReferralCode.js";
import { createCustomError } from "../core/errors/createCustomError.js";
import { MAX_UID_COLLISION_RETRIES } from "../../constants/auth/UID_COLLISION.js";
import { assertInstagramNotBannedOrThrow } from "../instagram/assertInstagramNotBannedOrThrow.js";
import type {
  SupportedLocale,
  SupportedLanguage,
} from "@tagly/models/shared";

/**
 * Creates a customer record with a unique UID, retrying on collision.
 * Also generates a unique referral code for the new customer.
 *
 * Must be called inside a Prisma transaction.
 */
export async function createCustomerWithUniqueUid(
  tx: Prisma.TransactionClient,
  args: {
    email: string;
    fullName: string;
    gender: Gender;
    locale: SupportedLocale;
    language: SupportedLanguage;
    interestIds: number[];
    instagramDbId: number | null;
    accountReferralId?: number | null;
    agreedToTermsOfServiceAt: Date;
    agreedToPrivacyPolicyAt: Date;
    promoNotificationsEnabled: boolean | null;
  },
) {
  // Block re-using a banned Instagram on a brand-new account. Single chokepoint
  // for every customer-creation path (IG present or not). The IG uid lives on
  // the linked CustomerInstagramAccount row, so resolve it from the passed
  // dbId; throwing here rolls back the whole creation transaction.
  if (args.instagramDbId != null) {
    const ig = await tx.customerInstagramAccount.findUnique({
      where: { id: args.instagramDbId },
      select: { instagramUid: true },
    });
    if (ig) await assertInstagramNotBannedOrThrow(ig.instagramUid, tx);
  }

  for (let attempt = 0; attempt < MAX_UID_COLLISION_RETRIES; attempt++) {
    const uid = generateUid("CUSTOMER");
    try {
      const customer = await tx.customer.create({
        data: {
          email: args.email,
          uid,
          fullName: args.fullName,
          gender: args.gender,
          locale: args.locale,
          language: args.language,
          interests: {
            connect: args.interestIds.map((id) => ({ id })),
          },
          agreedToTermsOfServiceAt: args.agreedToTermsOfServiceAt,
          agreedToPrivacyPolicyAt: args.agreedToPrivacyPolicyAt,
          sensitiveData: { create: {} },
          promoNotificationsEnabled: args.promoNotificationsEnabled ?? undefined,
          accountReferral: {
            create: {
              code: generateReferralCode("CUSTOMER"),
              referredEvent: args.accountReferralId
                ? {
                    create: {
                      referrerCodeId: args.accountReferralId,
                    },
                  }
                : undefined,
            },
          },
          ...(args.instagramDbId != null && {
            instagram: { connect: { id: args.instagramDbId } },
          }),
        },
        select: {
          id: true,
          uid: true,
          instagram: { select: { id: true } },
          jwtVersion: true,
        },
      });

      return customer;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = err.meta?.target as string | string[] | undefined;
        const includes = (needle: string) =>
          Array.isArray(target)
            ? target.includes(needle)
            : typeof target === "string"
              ? target.includes(needle)
              : false;

        if (includes("code")) continue; // regenerate referral code
        if (includes("uid")) continue; // regenerate UID
      }
      throw err;
    }
  }

  throw createCustomError(5202, "Failed to create customer", 500);
}
