import { z } from "zod";
import { SupportedLocaleSchema } from "../../../../core/locale";

/**
 * `GET /v2/public/auth/customers/check-registration` — on app launch, resolve
 * where to drop a user back into onboarding from a stored `registrationToken`.
 * Returns enough state for the client to resume at the right step (promo →
 * profile → instagram) without re-asking completed steps.
 */
export const CheckRegistrationQuerySchema = z.object({
  registrationToken: z.string().min(1),
});
export type CheckRegistrationQuery = z.infer<
  typeof CheckRegistrationQuerySchema
>;

/**
 * `profileComplete` — profile step already done (skip to Instagram).
 * `locale` — the locale stored on the pending account, so resume can drive the
 * EU/CZ-only marketing step authoritatively without re-guessing via suggest-locale.
 * `marketingConsentResolved` — whether the promo opt-in has been answered
 * (`promoNotificationsEnabled !== null`), so resume doesn't re-show the consent
 * step it already completed.
 */
export const CheckRegistrationResponseSchema = z.object({
  profileComplete: z.boolean(),
  locale: SupportedLocaleSchema,
  marketingConsentResolved: z.boolean(),
});
export type CheckRegistrationResponse = z.infer<
  typeof CheckRegistrationResponseSchema
>;
