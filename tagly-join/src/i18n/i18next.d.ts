// Compile-time type safety: derives the translation key contract from the
// English locale JSON so t("key") autocompletes and typo-checks. en/cs parity
// is still a runtime concern (keys are derived from English only).
//
// tsconfig.json includes **/*.ts, so this dedicated .d.ts is in the TS program.

import "i18next";
import type copy from "./locales/en/copy.json";
import type layout from "./locales/en/layout.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "copy";
    resources: {
      copy: typeof copy;
      layout: typeof layout;
    };
  }
}
