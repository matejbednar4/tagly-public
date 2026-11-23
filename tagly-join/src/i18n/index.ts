// Per-request i18next factory for the tagly-join.
//
// NOTE: this intentionally differs from the React Native system in
// tagly-shared/client/i18n, which uses a single mutable global singleton. On a
// Next.js server one process serves many concurrent requests, so a shared
// instance with one `language` field would race across requests (one
// visitor's language leaking into another's response). Instead we build a
// fresh instance per request via createInstance() and discard it.

import { createInstance, type i18n, type Namespace } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { getOptions, type Language } from "./settings";

// Server-side only. Deliberately does NOT use react-i18next: this module is
// imported by Server Components (RSC graph), and react-i18next evaluates
// React.createContext at import time, which the react-server build doesn't
// expose. The browser binding lives in TranslationsProvider.tsx (a client
// module) instead.
export async function initI18next(
  lng: Language,
  ns: string | string[],
): Promise<i18n> {
  const instance = createInstance();
  await instance
    .use(
      resourcesToBackend(
        // Keep this template literal in exactly this shape so the bundler can
        // statically code-split each locales/<lang>/<ns>.json file.
        (language: string, namespace: string) =>
          import(`./locales/${language}/${namespace}.json`),
      ),
    )
    .init(getOptions(lng, ns));
  return instance;
}

export async function getTranslation(
  lng: Language,
  ns: string | string[] = "copy",
) {
  const instance = await initI18next(lng, ns);
  const primaryNs = (Array.isArray(ns) ? ns[0] : ns) as Namespace;
  return {
    t: instance.getFixedT(lng, primaryNs),
    i18n: instance,
  };
}
