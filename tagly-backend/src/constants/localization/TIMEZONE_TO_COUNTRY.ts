import type { SupportedLocale } from "@tagly/models/shared";

/**
 * IANA-timezone → ISO alpha-2 country code, for the supported locales only
 * (US, CZ). Intentionally narrow — just the timezones our two userbases
 * actually configure their phones to, not a full TZ database.
 *
 * Adding a new SupportedLocale means extending this map (one block per country)
 * plus the enum in `tagly-shared/models/src/core/locale.ts`. The lookup itself lives
 * in `utils/localization/getCountryForTimezone`.
 */
export const TIMEZONE_TO_COUNTRY: Record<string, SupportedLocale> = {
  // United States — all common IANA TZs used by US devices
  "America/New_York": "US",
  "America/Detroit": "US",
  "America/Kentucky/Louisville": "US",
  "America/Kentucky/Monticello": "US",
  "America/Indiana/Indianapolis": "US",
  "America/Indiana/Vincennes": "US",
  "America/Indiana/Winamac": "US",
  "America/Indiana/Marengo": "US",
  "America/Indiana/Petersburg": "US",
  "America/Indiana/Vevay": "US",
  "America/Indiana/Tell_City": "US",
  "America/Indiana/Knox": "US",
  "America/Menominee": "US",
  "America/Chicago": "US",
  "America/North_Dakota/Center": "US",
  "America/North_Dakota/New_Salem": "US",
  "America/North_Dakota/Beulah": "US",
  "America/Denver": "US",
  "America/Boise": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "America/Juneau": "US",
  "America/Sitka": "US",
  "America/Metlakatla": "US",
  "America/Yakutat": "US",
  "America/Nome": "US",
  "America/Adak": "US",
  "Pacific/Honolulu": "US",

  // Czechia — there's effectively only one
  "Europe/Prague": "CZ",
};
