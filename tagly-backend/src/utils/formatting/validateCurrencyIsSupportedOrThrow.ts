import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "@tagly/models/shared";
import { createCustomError } from "../core/errors/createCustomError.js";

/**
 * Normalizes a currency string (`.trim().toLowerCase()`) and asserts it's in
 * `SUPPORTED_CURRENCIES`. Returns the normalized value typed as
 * `SupportedCurrency`.
 *
 * Throws 1320 (HTTP 500) on invalid input — an unsupported currency reaching
 * this util means the calling code wrote it into our own DB or accepted it
 * from an untrusted source, which is a programmer error, not a client error.
 */
export function validateCurrencyIsSupportedOrThrow(
  raw: string,
): SupportedCurrency {
  const normalized = raw.trim().toLowerCase();
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(normalized)) {
    throw createCustomError(
      1320,
      `unsupported currency: ${raw}`,
      500,
    );
  }
  return normalized as SupportedCurrency;
}
