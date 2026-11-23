// The namespace registry: every i18n namespace mapped to a lazy loader per
// language.
//
// WHY THIS FILE EXISTS: translation JSON lives NEXT TO the page or component
// that uses it (`pricing.en.json` beside `pricing/page.tsx`), matching the
// convention the RN apps follow — see `tagly-shared/client/CLAUDE.md`. There is
// no central catalog to glob, so the mapping has to be written out once, here.
//
// WHY THUNKS AND NOT PLAIN IMPORTS: each value is a FUNCTION returning
// `import(...)`, so the bundler code-splits every namespace into its own chunk
// and a page downloads only what it renders. Turning these into eager top-level
// imports would pull all 58 JSON files into the client bundle. Keep them lazy.
//
// ADDING A NAMESPACE: create `<namespace>.en.json` + `<namespace>.cs.json` next
// to its page/component, then add one entry below. The key is the namespace id
// used in `getTranslation(lng, "<namespace>")`, and it must equal the filename
// stem so the two stay greppable together.

/** A lazily-imported translation JSON module. */
type NamespaceLoader = () => Promise<{ default: Record<string, unknown> }>;

export const resources: Record<string, Record<string, NamespaceLoader>> = {
  // Shared across pages — these have no single owning page or component, so
  // they stay here next to the i18n infrastructure.
  common: {
    en: () => import("./common.en.json"),
    cs: () => import("./common.cs.json"),
  },
  // Shared by the three `*-vs-tagly` comparison pages, which have no common
  // parent route folder and no single owning component.
  // UNPUBLISHED 2026-08-08 (the comparison pages moved to src/_unpublished
  // pending a copy rewrite) — restore this entry together with the pages.
  // comparison: {
  //   en: () => import("./comparison.en.json"),
  //   cs: () => import("./comparison.cs.json"),
  // },

  // Layout components.
  navbar: {
    en: () => import("@/components/layout/navbar.en.json"),
    cs: () => import("@/components/layout/navbar.cs.json"),
  },
  footer: {
    en: () => import("@/components/layout/footer.en.json"),
    cs: () => import("@/components/layout/footer.cs.json"),
  },
  "cookie-bar": {
    en: () => import("@/components/layout/cookie-bar.en.json"),
    cs: () => import("@/components/layout/cookie-bar.cs.json"),
  },
  // Rendered through LegalDocPage by all three legal routes.
  legal: {
    en: () => import("@/components/sections/legal.en.json"),
    cs: () => import("@/components/sections/legal.cs.json"),
  },

  // Pages.
  home: {
    en: () => import("@/app/[lng]/home.en.json"),
    cs: () => import("@/app/[lng]/home.cs.json"),
  },
  about: {
    en: () => import("@/app/[lng]/about/about.en.json"),
    cs: () => import("@/app/[lng]/about/about.cs.json"),
  },
  // UNPUBLISHED 2026-08-08: the SEO/industry/comparison/customer/careers/demo
  // pages moved to src/_unpublished/[lng]/ pending a copy rewrite (Matej's
  // call — the copy needs redoing before these ship again). To restore a page:
  // move its folder back under src/app/[lng]/, uncomment its entry here (point
  // the imports back at @/app/[lng]/...), re-add it to sitemap.ts and the
  // Footer, and drop its temporary redirect in next.config.ts.
  // cafes: {
  //   en: () => import("@/_unpublished/[lng]/cafes/cafes.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/cafes/cafes.cs.json"),
  // },
  // careers: {
  //   en: () => import("@/_unpublished/[lng]/careers/careers.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/careers/careers.cs.json"),
  // },
  contact: {
    en: () => import("@/app/[lng]/contact/contact.en.json"),
    cs: () => import("@/app/[lng]/contact/contact.cs.json"),
  },
  "contact-form": {
    en: () => import("@/components/contact/contact-form.en.json"),
    cs: () => import("@/components/contact/contact-form.cs.json"),
  },
  // demo: {
  //   en: () => import("@/_unpublished/[lng]/demo/demo.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/demo/demo.cs.json"),
  // },
  // faq: {
  //   en: () => import("@/_unpublished/[lng]/faq/faq.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/faq/faq.cs.json"),
  // },
  // "for-customers-faq": {
  //   en: () => import("@/_unpublished/[lng]/for-customers/faq/for-customers-faq.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/for-customers/faq/for-customers-faq.cs.json"),
  // },
  // "for-customers-how-it-works": {
  //   en: () =>
  //     import(
  //       "@/_unpublished/[lng]/for-customers/how-it-works/for-customers-how-it-works.en.json"
  //     ),
  //   cs: () =>
  //     import(
  //       "@/_unpublished/[lng]/for-customers/how-it-works/for-customers-how-it-works.cs.json"
  //     ),
  // },
  // gyms: {
  //   en: () => import("@/_unpublished/[lng]/gyms/gyms.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/gyms/gyms.cs.json"),
  // },
  // "how-it-works": {
  //   en: () => import("@/_unpublished/[lng]/how-it-works/how-it-works.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/how-it-works/how-it-works.cs.json"),
  // },
  // "influencer-marketing-vs-tagly": {
  //   en: () =>
  //     import(
  //       "@/_unpublished/[lng]/influencer-marketing-vs-tagly/influencer-marketing-vs-tagly.en.json"
  //     ),
  //   cs: () =>
  //     import(
  //       "@/_unpublished/[lng]/influencer-marketing-vs-tagly/influencer-marketing-vs-tagly.cs.json"
  //     ),
  // },
  // "instagram-ads-vs-tagly": {
  //   en: () =>
  //     import(
  //       "@/_unpublished/[lng]/instagram-ads-vs-tagly/instagram-ads-vs-tagly.en.json"
  //     ),
  //   cs: () =>
  //     import(
  //       "@/_unpublished/[lng]/instagram-ads-vs-tagly/instagram-ads-vs-tagly.cs.json"
  //     ),
  // },
  "instagram-data-deletion": {
    en: () =>
      import(
        "@/app/[lng]/instagram-data-deletion/instagram-data-deletion.en.json"
      ),
    cs: () =>
      import(
        "@/app/[lng]/instagram-data-deletion/instagram-data-deletion.cs.json"
      ),
  },
  // "local-businesses": {
  //   en: () => import("@/_unpublished/[lng]/local-businesses/local-businesses.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/local-businesses/local-businesses.cs.json"),
  // },
  // "marketing-agencies-vs-tagly": {
  //   en: () =>
  //     import(
  //       "@/_unpublished/[lng]/marketing-agencies-vs-tagly/marketing-agencies-vs-tagly.en.json"
  //     ),
  //   cs: () =>
  //     import(
  //       "@/_unpublished/[lng]/marketing-agencies-vs-tagly/marketing-agencies-vs-tagly.cs.json"
  //     ),
  // },
  // pricing: {
  //   en: () => import("@/_unpublished/[lng]/pricing/pricing.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/pricing/pricing.cs.json"),
  // },
  // referrals: {
  //   en: () => import("@/_unpublished/[lng]/referrals/referrals.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/referrals/referrals.cs.json"),
  // },
  // restaurants: {
  //   en: () => import("@/_unpublished/[lng]/restaurants/restaurants.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/restaurants/restaurants.cs.json"),
  // },
  // salons: {
  //   en: () => import("@/_unpublished/[lng]/salons/salons.en.json"),
  //   cs: () => import("@/_unpublished/[lng]/salons/salons.cs.json"),
  // },
  // The support namespace is gone: /support was merged into /contact
  // (2026-08-09, 301 in next.config.ts). Its form keys live in the contact
  // namespace; the rest of the old page copy is parked in
  // src/_unpublished/removed-copy/support-page.{en,cs}.json.
};

/**
 * Resolves one namespace for one language. Shared by the server (`index.ts`)
 * and client (`client.ts`) i18next instances so both see exactly the same set.
 *
 * Rejects loudly on an unregistered namespace: a silent empty resource renders
 * raw key strings ("hero.title") to users, which is worse than a build/runtime
 * error naming the missing entry.
 */
export function loadNamespace(language: string, namespace: string) {
  const loader = resources[namespace]?.[language];
  if (!loader) {
    return Promise.reject(
      new Error(
        `i18n: no "${language}" resource registered for namespace "${namespace}". ` +
          `Add it to src/lib/i18n/resources.ts.`,
      ),
    );
  }
  return loader();
}
