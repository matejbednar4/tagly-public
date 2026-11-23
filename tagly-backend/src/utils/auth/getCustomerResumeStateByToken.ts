import prisma from "../../prisma/prisma.js";
import { getRegistrationResumeState } from "./getRegistrationResumeState.js";

/**
 * Load a pending customer's onboarding resume state by registration token.
 *
 * The OAuth controllers get a `registrationToken` back from the shared,
 * account-agnostic {@link handleOAuthSignIn} (which can't carry customer-only
 * fields like marketing consent), but still need to return the same resume
 * shape as `verify-otp` / `check-registration`. The token was just created or
 * matched, so the pending row is expected to exist.
 */
export async function getCustomerResumeStateByToken(registrationToken: string) {
  const pending = await prisma.pendingCustomer.findUniqueOrThrow({
    where: { registrationToken },
    select: { fullName: true, locale: true, promoNotificationsEnabled: true },
  });
  return getRegistrationResumeState(pending);
}
