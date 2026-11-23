import { isCustomerProfileComplete } from "./isCustomerProfileComplete.js";
import { validateLocaleIsSupportedOrThrow } from "../localization/validateLocaleIsSupportedOrThrow.js";
import type { SupportedLocale } from "@tagly/models/shared";

/**
 * Onboarding "resume state" derived from a PendingCustomer — the facts the
 * client needs to drop a mid-registration user back at the right step without
 * re-asking completed ones.
 *
 * Shared by `check-registration` (launch-time resume from a stored token) and
 * `verify-otp` (logging into a pending account mid-onboarding) so both report
 * identical semantics from one place. The shape matches `CheckRegistrationResponse`.
 */
export function getRegistrationResumeState(pending: {
  fullName: string | null;
  locale: string;
  promoNotificationsEnabled: boolean | null;
}): {
  profileComplete: boolean;
  locale: SupportedLocale;
  marketingConsentResolved: boolean;
} {
  return {
    profileComplete: isCustomerProfileComplete(pending),
    locale: validateLocaleIsSupportedOrThrow(pending.locale),
    // null = promo opt-in not yet answered; non-null = the consent step is done.
    marketingConsentResolved: pending.promoNotificationsEnabled !== null,
  };
}
