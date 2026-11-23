import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@tagly/models/shared";
import { createCustomError } from "../core/errors/createCustomError.js";

/**
 * Normalizes a language string (`.trim().toLowerCase()`) and asserts it's in
 * `SUPPORTED_LANGUAGES`. Returns the normalized value typed as
 * `SupportedLanguage`.
 *
 * Throws 1331 (HTTP 500) on invalid input — an unsupported language reaching
 * this util means the calling code wrote it into our own DB or accepted it
 * from an untrusted source, which is a programmer error, not a client error.
 */
export function validateLanguageIsSupportedOrThrow(
  raw: string,
): SupportedLanguage {
  const normalized = raw.trim().toLowerCase();
  if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(normalized)) {
    throw createCustomError(1331, `unsupported language: ${raw}`, 500);
  }
  return normalized as SupportedLanguage;
}
