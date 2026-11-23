"use client";

import { useState } from "react";
import { createInstance, type Resource } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { getOptions, namespaces, type Language } from "./settings";

// Client-side i18next provider. The server (layout.tsx) detects the language,
// builds an instance, and hands its resources down as a serializable prop; we
// re-create a browser instance seeded with those same resources so client
// components (NavDrawer, StepCard) can call
// useTranslation(). Because resources are inlined (no async backend), init is
// synchronous and there is no loading flash. Server-component children passed
// through `children` are unaffected — only client descendants consume this.
export function TranslationsProvider({
  locale,
  resources,
  children,
}: {
  locale: Language;
  resources: Resource;
  children: React.ReactNode;
}) {
  const [instance] = useState(() => {
    const i18n = createInstance();
    i18n.use(initReactI18next).init({
      ...getOptions(locale, [...namespaces]),
      resources,
      // v26's name for the old initImmediate — false = synchronous init so
      // translations are ready on first render (no flash).
      initAsync: false,
    });
    return i18n;
  });

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
