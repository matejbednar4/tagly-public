import type { MetadataRoute } from "next";
import { languages } from "@/lib/i18n/settings";
import { isProduction, siteOrigin } from "@/lib/site";

// Locale-less paths ("" is the homepage). Each is emitted once per language
// with hreflang alternates pointing at the same page in every other language.
//
// UNPUBLISHED 2026-08-08 (pages moved to src/_unpublished pending a copy
// rewrite — re-add here when restoring): /how-it-works, /pricing, /faq,
// /referrals, /restaurants, /cafes, /gyms, /salons, /local-businesses, the
// three /*-vs-tagly comparisons, /for-customers/how-it-works,
// /for-customers/faq, /careers, /demo (was never listed).
const paths = [
  "",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
  "/terms-of-monetization",
  "/instagram-data-deletion",
];

export default function sitemap(): MetadataRoute.Sitemap {
  // Non-production deploys advertise nothing (they are noindexed and
  // robots-disallowed too — see src/lib/site.ts).
  if (!isProduction) {
    return [];
  }

  return paths.flatMap((path) => {
    const languageAlternates = Object.fromEntries(
      languages.map((lng) => [lng, `${siteOrigin}/${lng}${path}`]),
    );

    return languages.map((lng) => ({
      url: `${siteOrigin}/${lng}${path}`,
      alternates: { languages: languageAlternates },
    }));
  });
}
