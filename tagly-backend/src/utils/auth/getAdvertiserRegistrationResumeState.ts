import { validateLocaleIsSupportedOrThrow } from "../localization/validateLocaleIsSupportedOrThrow.js";
import type { SupportedLocale } from "@tagly/models/shared";

/**
 * Onboarding "resume state" derived from a PendingAdvertiserAccount — the facts
 * the client needs to drop a mid-registration advertiser back at the right step
 * without re-asking completed ones.
 *
 * Shared by `verify-otp` and the OAuth controllers so all three report identical
 * semantics from one place. Unlike the customer flow there is **no
 * `profileComplete`** — the advertiser has no pending-profile step (the account
 * is created first, business setup follows), so resume only carries `locale`
 * (drives the EU/CZ-only consent step) and whether marketing consent is resolved.
 * The shape matches the `registration` branch of the advertiser auth responses.
 */
export function getAdvertiserRegistrationResumeState(pending: {
  locale: string;
  promoNotificationsEnabled: boolean | null;
}): {
  locale: SupportedLocale;
  marketingConsentResolved: boolean;
} {
  return {
    locale: validateLocaleIsSupportedOrThrow(pending.locale),
    // null = promo opt-in not yet answered; non-null = the consent step is done.
    marketingConsentResolved: pending.promoNotificationsEnabled !== null,
  };
}
