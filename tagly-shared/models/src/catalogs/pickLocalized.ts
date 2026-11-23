import type { SupportedLanguage } from "../core/locale";
import type { Localized, LocalizedFn } from "./types";

export function pickLocalized(loc: Localized, lang: SupportedLanguage): string {
  return loc[lang] ?? loc.en;
}

export function pickLocalizedFn<P>(
  loc: LocalizedFn<P>,
  lang: SupportedLanguage,
  payload: P,
): string {
  const fn = loc[lang] ?? loc.en;
  return fn(payload);
}
