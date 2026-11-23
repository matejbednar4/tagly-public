// Server-side locale detection from the browser's Accept-Language header.
//
// Web equivalent of the RN system's getLocaleDefaults() (which reads the
// device OS locale). No middleware and no /en /cs URL prefixes — those would
// collide with the existing `/:code` -> `/?code=:code` referral rewrite in
// next.config.ts. Czech (cs) for Czech browsers, English for everyone else.

import { cookies, headers } from "next/headers";
import {
  fallbackLng,
  languages,
  LOCALE_COOKIE,
  type Language,
} from "./settings";

// Slovak browsers get Czech, matching the RN reference's CZ+SK -> cs behavior.
const LANGUAGE_ALIASES: Record<string, Language> = { sk: "cs" };

export async function detectLocale(): Promise<Language> {
  // cookies() and headers() are async in Next.js 16.

  // 1. An explicit choice from the NavDrawer picker wins over the browser.
  const cookieLang = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (cookieLang && (languages as readonly string[]).includes(cookieLang)) {
    return cookieLang as Language;
  }

  // 2. Otherwise fall back to the browser's Accept-Language.
  const header = (await headers()).get("accept-language") ?? "";

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return {
        // "cs-CZ" -> "cs"
        tag: tag.toLowerCase().split("-")[0],
        q: q ? parseFloat(q) : 1,
      };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const resolved = LANGUAGE_ALIASES[tag] ?? tag;
    if ((languages as readonly string[]).includes(resolved)) {
      return resolved as Language;
    }
  }

  return fallbackLng;
}
