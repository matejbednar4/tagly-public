import { createInstance } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next/initReactI18next";
import { getOptions, defaultNS } from "./settings";
import { loadNamespace } from "./resources";

// Server-side i18n. A fresh i18next instance is created per request so that
// concurrent requests for different languages never share mutable state.
//
// Namespaces are lazy-loaded from the JSON colocated with each page/component,
// via the registry in `resources.ts` — add a namespace there.
async function initI18next(lng: string, ns: string | string[]) {
  const instance = createInstance();
  await instance
    .use(initReactI18next)
    .use(resourcesToBackend(loadNamespace))
    .init(getOptions(lng, ns));
  return instance;
}

// Use in server components / pages:
//   const { t } = await getTranslation(lng, ["home", "common"]);
//   t("hero.title");           // from the first namespace ("home")
//   t("common:getInTouch");    // explicit namespace
export async function getTranslation(
  lng: string,
  ns: string | string[] = defaultNS,
  options: { keyPrefix?: string } = {},
) {
  const i18n = await initI18next(lng, ns);
  const firstNS = Array.isArray(ns) ? ns[0] : ns;
  return {
    t: i18n.getFixedT(lng, firstNS, options.keyPrefix),
    i18n,
  };
}
