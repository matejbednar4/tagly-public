import prisma from "../../prisma/prisma.js";
import { getAdvertiserRegistrationResumeState } from "./getAdvertiserRegistrationResumeState.js";

/**
 * Load a pending advertiser's onboarding resume state by registration token.
 *
 * The OAuth controllers get a `registrationToken` back from the shared,
 * account-agnostic {@link handleOAuthSignIn} (which can't carry the marketing
 * consent field), but still need to return the same resume shape as
 * `verify-otp`. The token was just created or matched, so the pending row is
 * expected to exist.
 */
export async function getAdvertiserResumeStateByToken(registrationToken: string) {
  const pending = await prisma.pendingAdvertiserAccount.findUniqueOrThrow({
    where: { registrationToken },
    select: { locale: true, promoNotificationsEnabled: true },
  });
  return getAdvertiserRegistrationResumeState(pending);
}
