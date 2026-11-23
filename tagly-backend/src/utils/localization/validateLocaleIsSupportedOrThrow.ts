import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@tagly/models/shared";
import { createCustomError } from "../core/errors/createCustomError.js";

/**
 * Normalizes a locale string (`.trim().toUpperCase()`) and asserts it's in
 * `SUPPORTED_LOCALES`. Returns the normalized value typed as `SupportedLocale`.
 *
 * Throws 1330 (HTTP 500) on invalid input — an unsupported locale reaching
 * this util means the calling code wrote it into our own DB or accepted it
 * from an untrusted source, which is a programmer error, not a client error.
 */
export function validateLocaleIsSupportedOrThrow(raw: string): SupportedLocale {
  const normalized = raw.trim().toUpperCase();
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(normalized)) {
    throw createCustomError(1330, `unsupported locale: ${raw}`, 500);
  }
  return normalized as SupportedLocale;
}
