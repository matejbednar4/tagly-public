import { z } from "zod";
import { SupportedLocaleSchema } from "../../../../core/locale";

/**
 * `GET /v2/public/auth/advertisers/check-registration` — on app launch, resolve
 * where to drop a user back into onboarding from a stored `registrationToken`.
 * Returns enough state for the client to resume at the right step (notifications
 * → consent → finishing) without re-asking completed steps.
 *
 * Unlike the customer flow there is **no `profileComplete`** — the advertiser has
 * no pending-profile step (the account is created first, business setup follows).
 */
export const CheckRegistrationQuerySchema = z.object({
  registrationToken: z.string().min(1),
});
export type CheckRegistrationQuery = z.infer<
  typeof CheckRegistrationQuerySchema
>;

/**
 * `locale` — the locale stored on the pending account, so resume can drive the
 * EU/CZ-only marketing step authoritatively without re-guessing via suggest-locale.
 * `marketingConsentResolved` — whether the promo opt-in has been answered
 * (`promoNotificationsEnabled !== null`), so resume doesn't re-show the consent
 * step it already completed. (The notifications step is tracked client-side.)
 */
export const CheckRegistrationResponseSchema = z.object({
  locale: SupportedLocaleSchema,
  marketingConsentResolved: z.boolean(),
});
export type CheckRegistrationResponse = z.infer<
  typeof CheckRegistrationResponseSchema
>;
