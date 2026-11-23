import type { Metadata } from "next";
import { languages, defaultLng } from "./settings";

// Builds the `alternates` block for a localized page: a locale-correct canonical
// plus hreflang entries for every supported language. `path` is the locale-less
// route (e.g. "/restaurants", or "" for the homepage).
export function buildAlternates(lng: string, path: string): Metadata["alternates"] {
  return {
    canonical: `/${lng}${path}`,
    languages: {
      ...Object.fromEntries(
        languages.map((language) => [language, `/${language}${path}`]),
      ),
      // Where a crawler should send a visitor whose language matches neither
      // entry above. It must agree with the middleware's `defaultLng`, or the
      // site tells search engines one thing and does another.
      "x-default": `/${defaultLng}${path}`,
    },
  };
}

// Maps a UI language to an Open Graph locale string.
export function ogLocale(lng: string): string {
  return lng === "cs" ? "cs_CZ" : "en_US";
}
