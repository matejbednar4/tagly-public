"use client";

import { useEffect } from "react";
import i18next from "i18next";
import {
  initReactI18next,
  useTranslation as useTranslationOrg,
} from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { getOptions, languages, cookieName } from "./settings";
import { loadNamespace } from "./resources";

const runsOnServerSide = typeof window === "undefined";

// The browser instance must wake up in the language the server rendered the
// page in — and the server rendered whatever the URL's [lng] segment says,
// so the initial client language comes from the path. Passing getOptions()
// with no argument here used to pin `lng` to defaultLng ("cs"), which made
// every /en page hydrate its client components in Czech and React log a
// hydration mismatch + regenerate the tree (e.g. the contact form flashing
// "Vaše jméno" for "Your name"). Because `lng` is always set, the detector's
// `order` never picks the language — it stays registered only so `caches`
// writes the visitor's language into the locale cookie for the middleware.
const pathLng = runsOnServerSide
  ? undefined
  : window.location.pathname.split("/")[1];
const initialClientLng =
  pathLng && (languages as readonly string[]).includes(pathLng)
    ? pathLng
    : undefined;

i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(resourcesToBackend(loadNamespace))
  .init({
    ...getOptions(initialClientLng),
    detection: {
      order: ["path", "cookie", "navigator"],
      lookupCookie: cookieName,
      caches: ["cookie"],
    },
    // Preload during SSR; in the browser languages load on demand.
    preload: runsOnServerSide ? languages : [],
  });

// Use in client components ("use client"):
//   const { lng } = useParams();
//   const { t } = useTranslation(lng as string, ["navbar", "common"]);
export function useTranslation(
  lng: string,
  ns: string | string[],
  options?: Parameters<typeof useTranslationOrg>[1],
) {
  const ret = useTranslationOrg(ns, options);
  const { i18n } = ret;

  // On the server, set the language synchronously so the SSR markup renders in
  // the right language. On the client, do it in an effect — calling
  // changeLanguage during render triggers a setState in react-i18next's
  // listeners, which React forbids ("Cannot update a component while rendering").
  if (runsOnServerSide && lng && i18n.resolvedLanguage !== lng) {
    i18n.changeLanguage(lng);
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (!lng || i18n.resolvedLanguage === lng) return;
      i18n.changeLanguage(lng);
    }, [lng, i18n]);
  }

  return ret;
}
