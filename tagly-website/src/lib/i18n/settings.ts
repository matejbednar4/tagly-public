// Central configuration for i18n. Single source of truth for the supported
// languages and the i18next init options shared by the server and client setups.

export const languages = ["en", "cs"] as const;
export type Language = (typeof languages)[number];

/**
 * The language a visitor gets when we cannot tell what they want — no locale in
 * the URL, no stored choice, and no `Accept-Language` match. **Czech**, because
 * the home market is Prague: an unidentifiable visitor is far likelier to be
 * Czech than English-speaking, and crawlers (which send no `Accept-Language`)
 * should land on the Czech site.
 *
 * Note the consequence: a visitor whose browser is neither Czech nor English —
 * German, Polish — now gets Czech rather than English. That is the intended
 * trade for a Prague-first site; Slovak speakers in particular are better served
 * by it.
 *
 * NOT the same thing as `translationFallbackLng` below. This one decides which
 * language a person is *shown*; that one decides which language patches a
 * missing key.
 */
export const defaultLng: Language = "cs";

/**
 * The language that supplies a key missing from the active language. **English**,
 * and deliberately not `defaultLng`: copy is authored in EN and then translated
 * (see CLAUDE.md), so EN is the most complete catalogue. A gap in the Czech
 * copy should surface English text, never the reverse — Czech leaking onto an
 * English page would be the worse failure.
 */
export const translationFallbackLng: Language = "en";

export const defaultNS = "common";
export const cookieName = "i18next";

export function getOptions(
  lng: string = defaultLng,
  ns: string | string[] = defaultNS,
) {
  return {
    // Restrict to known languages so unexpected values fall back cleanly.
    supportedLngs: languages,
    // i18next's own option: which language patches a missing key (EN, the
    // source language) — not which language a visitor is shown.
    fallbackLng: translationFallbackLng,
    // Bare keys that are missing in a page namespace fall back to `common`.
    fallbackNS: defaultNS,
    defaultNS,
    lng,
    ns,
  };
}
