import type { SupportedLocale } from "@tagly/models/shared";
import { TIMEZONE_TO_COUNTRY } from "../../constants/localization/TIMEZONE_TO_COUNTRY.js";

/**
 * IANA-timezone → ISO alpha-2 country code (supported locales only). Unknown
 * timezones return null; the suggest-locale aggregator treats that as an absent
 * signal. The mapping data lives in `constants/localization/TIMEZONE_TO_COUNTRY`.
 */
export function getCountryForTimezone(
  timezone: string | undefined | null,
): SupportedLocale | null {
  if (!timezone) return null;
  return TIMEZONE_TO_COUNTRY[timezone] ?? null;
}
