import { z } from "zod";

// Locales the platform tracks end-to-end. ISO alpha-2, uppercase. Adding a new
// locale is a one-line change here once any per-locale rules (KYC, ToS, Stripe
// Connect country) land — for now we only use this for tracking + segmentation.
export const SUPPORTED_LOCALES = ["US", "CZ"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const SupportedLocaleSchema = z.enum(SUPPORTED_LOCALES);

// Languages the platform supports for user-facing copy (push, email, in-app
// strings). ISO 639-1, lowercase. The language signal is stored on every
// account; rendering localized templates is a separate piece of work.
export const SUPPORTED_LANGUAGES = ["en", "cs"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const SupportedLanguageSchema = z.enum(SUPPORTED_LANGUAGES);

// Locales subject to EU consent law (GDPR / ePrivacy). Drives whether the
// onboarding UI must show explicit ToS / privacy / promo opt-in toggles
// instead of bundling them under a "by continuing you agree…" microcopy.
// Add new EU locales here as they're rolled out.
export const EU_LOCALES = new Set<SupportedLocale>(["CZ"]);
export function isEULocale(locale: SupportedLocale): boolean {
  return EU_LOCALES.has(locale);
}
