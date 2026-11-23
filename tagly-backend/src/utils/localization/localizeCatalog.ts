import type { SupportedLanguage } from "@tagly/models/shared";

/**
 * Display labels for verticals / advertiser types / interests / notification
 * events live in the @tagly/models catalog (`{ en, cs }` per slug) and are
 * localized on the CLIENT (`useCatalogLocalizer`); the API sends slugs only.
 * Nothing here composes English names onto rows any more.
 */

/** Coerce a stored language string to a `SupportedLanguage`. */
export function normalizeLanguage(
  raw: string | null | undefined,
): SupportedLanguage {
  return raw === "cs" ? "cs" : "en";
}
