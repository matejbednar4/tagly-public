import { i18n } from "../../i18n";

const WEBSITE_ORIGIN = "https://www.taglyapp.com";

/**
 * Builds a taglyapp.com URL carrying the app's active display language as the
 * locale path prefix (/en, /cs), so the in-app browser lands on the page in the
 * language the user chose in the app instead of the website guessing from the
 * device's Accept-Language (which can differ from the app setting).
 *
 * If the active i18n language is ever not a locale the website serves, the
 * prefix is omitted and the website's own middleware resolves the locale,
 * i.e. the pre-existing behavior.
 */
export function websiteUrl(path: string): string {
  const lang = i18n.language;
  const prefix = lang === "en" || lang === "cs" ? `/${lang}` : "";
  return `${WEBSITE_ORIGIN}${prefix}${path}`;
}
