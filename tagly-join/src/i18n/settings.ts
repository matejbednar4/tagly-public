// i18n configuration for the tagly-join. Shared by the init factory (index.ts),
// locale detection (detectLocale.ts), and the (later) client provider.
// Pure config — no runtime imports so it is safe to import from anywhere.

export const languages = ["en", "cs"] as const;
export type Language = (typeof languages)[number];

export const fallbackLng: Language = "en";

// Cookie set by the NavDrawer's language picker to override Accept-Language.
export const LOCALE_COOKIE = "tagly-locale";

export const defaultNS = "copy" as const;
export const namespaces = ["copy", "layout"] as const;

export function getOptions(
  lng: Language = fallbackLng,
  ns: string | string[] = defaultNS,
) {
  return {
    // mutable copy — i18next mutates supportedLngs internally
    supportedLngs: [...languages],
    fallbackLng,
    lng,
    fallbackNS: defaultNS,
    defaultNS,
    ns,
    interpolation: {
      // React already escapes interpolated values; there is no HTML sink here.
      escapeValue: false,
    },
  };
}
