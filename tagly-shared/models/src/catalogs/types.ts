import type { SupportedLanguage } from "../core/locale";

export type Localized = {
  en: string;
  cs: string;
};

export type LocalizedFn<P> = {
  en: (payload: P) => string;
  cs: (payload: P) => string;
};

export type LocalizedOrFn<P> = Localized | LocalizedFn<P>;

export type { SupportedLanguage };
