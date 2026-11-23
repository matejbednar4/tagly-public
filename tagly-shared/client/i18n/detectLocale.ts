import * as Localization from "expo-localization";

export type Language = "en" | "cs";
export type DistanceUnit = "KM" | "MI";

export type LocaleDefaults = {
  language: Language;
  distanceUnit: DistanceUnit;
};

/**
 * Device languages that should open the app in Czech. Slovak is included
 * deliberately: Slovak speakers read Czech comfortably and there is no Slovak
 * translation, so `sk` is a far better match for them than English.
 */
const CZECH_LANGUAGES = new Set(["cs", "sk"]);

/**
 * Returns locale-aware defaults for language and distance unit based on the
 * device's OS settings — no GPS or permissions required.
 *
 * The two defaults read **different** signals on purpose:
 *  - **Language** follows the device's preferred *languages*, because that is
 *    what the user actually reads. Region is only a proxy for it and gets
 *    expats wrong in both directions (a Czech phone in the US would have
 *    opened in English; an English phone in Czechia in Czech).
 *  - **Distance unit** follows the region's measurement system, which genuinely
 *    is a question of where you are.
 *
 * `getLocales()` is ordered by preference, so the first *supported* language
 * wins rather than just the first entry — a device set to `[sk, cs, en]`
 * resolves to Czech, not English.
 *
 * Called once on first launch (when no stored preferences exist), so changing
 * this only affects new installs; a stored or manually chosen language is never
 * overridden.
 */
export function getLocaleDefaults(): LocaleDefaults {
  try {
    const locales = Localization.getLocales();

    // expo-localization exposes the measurement system directly.
    const distanceUnit: DistanceUnit =
      locales[0]?.measurementSystem === "us" ||
      locales[0]?.measurementSystem === "uk"
        ? "MI"
        : "KM";

    const language: Language = locales.some((l) =>
      CZECH_LANGUAGES.has(l.languageCode?.toLowerCase() ?? ""),
    )
      ? "cs"
      : "en";

    return { language, distanceUnit };
  } catch (e) {
    return { language: "en", distanceUnit: "MI" };
  }
}
