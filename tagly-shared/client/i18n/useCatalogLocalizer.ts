import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  advertiserTypeBySlug,
  interestBySlug,
  verticalBySlug,
  rewardMessageBySlug,
  notificationCategoryBySlug,
  notificationEventBySlug,
  pickLocalized,
  humanizeSlug,
  type SupportedLanguage,
} from "@tagly/models/shared";

function normalizeLang(raw: string | undefined): SupportedLanguage {
  return raw === "cs" ? "cs" : "en";
}

/**
 * Returns helpers that map a catalog slug to the active i18n language's
 * display name. Backed by the shared `@tagly/models` catalog so the lookup
 * is reactive to language changes — when the user switches language, every
 * component that uses these helpers re-renders with the new name without
 * needing to refetch from the API.
 *
 * Client code should treat the catalog as the only source of display names.
 * The wire still carries a deprecated `name` field (English) for old client
 * builds, but new code should never read it — pass only the slug.
 *
 * Fallback chain on catalog miss:
 *   1. Slug not in bundled catalog (usually because the backend shipped a
 *      new slug ahead of the FE catalog update) → return `humanizeSlug(slug)`
 *      so the user sees e.g. "Shares Rated" instead of "c.shares.rated".
 *   2. For optional descriptions, return `null` so the UI can hide them.
 *
 * @example
 *   const { typeName } = useCatalogLocalizer();
 *   return <Text>{typeName(local.type.slug)}</Text>;
 */
export function useCatalogLocalizer() {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);

  return useMemo(
    () => ({
      typeName: (slug: string): string => {
        const entry = advertiserTypeBySlug.get(slug);
        if (!entry) return humanizeSlug(slug);
        return pickLocalized(entry.name, lang);
      },
      interestName: (slug: string): string => {
        const entry = interestBySlug.get(slug);
        if (!entry) return humanizeSlug(slug);
        return pickLocalized(entry.name, lang);
      },
      verticalName: (slug: string): string => {
        const entry = verticalBySlug.get(slug);
        if (!entry) return humanizeSlug(slug);
        return pickLocalized(entry.name, lang);
      },

      rewardMessageName: (slug: string): string => {
        const entry = rewardMessageBySlug.get(slug);
        if (!entry) return humanizeSlug(slug);
        return pickLocalized(entry.name, lang);
      },

      notificationCategoryName: (slug: string): string => {
        const entry = notificationCategoryBySlug.get(slug);
        if (!entry) return humanizeSlug(slug);
        return pickLocalized(entry.name, lang);
      },
      notificationCategoryCustomerDescription: (
        slug: string,
      ): string | null => {
        const entry = notificationCategoryBySlug.get(slug);
        if (!entry?.customerDescription) return null;
        return pickLocalized(entry.customerDescription, lang);
      },
      notificationCategoryAdvertiserDescription: (
        slug: string,
      ): string | null => {
        const entry = notificationCategoryBySlug.get(slug);
        if (!entry?.advertiserDescription) return null;
        return pickLocalized(entry.advertiserDescription, lang);
      },

      notificationEventLabel: (slug: string): string => {
        const entry = notificationEventBySlug.get(slug);
        if (!entry) return humanizeSlug(slug);
        return pickLocalized(entry.label, lang);
      },
      notificationEventDescription: (slug: string): string | null => {
        const entry = notificationEventBySlug.get(slug);
        if (!entry) return null;
        return pickLocalized(entry.description, lang);
      },
      lang,
    }),
    [lang],
  );
}
