import type { NextConfig } from "next";

// Environment gate. Non-production builds are made unfindable by search
// engines (X-Robots-Tag header below, robots.txt disallow, empty sitemap,
// robots meta — see src/lib/site.ts), so a build with APP_ENV missing or
// mistyped would either leak a crawlable staging site or ship a noindexed
// production site. Fail the build instead — same rule as tagly-join. Set it
// locally in tagly-website/.env (development) and per Amplify branch
// (staging | production).
const ALLOWED_ENVS = ["development", "staging", "production"];
const appEnv = process.env.APP_ENV;
if (!appEnv || !ALLOWED_ENVS.includes(appEnv)) {
  throw new Error(
    "APP_ENV must be set to one of: development, staging, production",
  );
}

// PostHog is the site's only analytics, and `NEXT_PUBLIC_*` is INLINED AT BUILD
// TIME — so a build with the var missing produces a site that looks perfectly
// healthy and tracks nothing, forever, with no runtime signal. Fail the build
// instead. (Next loads .env before evaluating this file, so local dev works off
// tagly-website/.env; deploys read it from the Amplify console env vars.)
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (!posthogKey) {
  throw new Error(
    "Missing required environment variable: NEXT_PUBLIC_POSTHOG_KEY. " +
      "Set it locally in tagly-website/.env, and on the Amplify app as an " +
      "environment variable. It is the publishable phc_* project key.",
  );
}
// Guard against pasting a PERSONAL/secret PostHog key here: anything in
// NEXT_PUBLIC_* is compiled into the public client bundle, so a non-phc_ key
// would be published to every visitor. Only the phc_* project key is
// publishable-class.
if (!posthogKey.startsWith("phc_")) {
  throw new Error(
    "NEXT_PUBLIC_POSTHOG_KEY must be the publishable phc_* project key. " +
      "Personal API keys are secrets and must never be exposed in a client bundle.",
  );
}

// UNPUBLISHED 2026-08-08: these pages moved to src/_unpublished pending a copy
// rewrite (see src/lib/i18n/resources.ts for the restore checklist). Their
// URLs were indexed and linked, so instead of 404ing they get TEMPORARY
// (302/307) redirects to the homepage — temporary on purpose, so search
// engines keep the URLs and the pages can come back. Remove a page's slug
// from this list when restoring it.
const unpublishedSlugs = [
  "how-it-works",
  "pricing",
  "faq",
  "referrals",
  "restaurants",
  "cafes",
  "gyms",
  "salons",
  "local-businesses",
  "instagram-ads-vs-tagly",
  "influencer-marketing-vs-tagly",
  "marketing-agencies-vs-tagly",
  "demo",
  "careers",
].join("|");

// Backend API base for the hero's public-stats counters. Inlined at build
// time (like tagly-join) because Amplify SSR compute does not reliably expose
// runtime env vars — and the homepage now renders per request, so a var that
// is only present at build would otherwise leave the count reading as a
// skeleton pill on every view. Unlike tagly-join this stays OPTIONAL: a
// missing var must never fail the marketing build, it just drops the number.
const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  env: {
    APP_ENV: appEnv,
    ...(apiBaseUrl ? { API_BASE_URL: apiBaseUrl } : {}),
  },
  // Non-production deploys must be completely unfindable: every response
  // (pages, static assets, API routes) carries X-Robots-Tag, which crawlers
  // honor even for non-HTML resources the robots meta tag can't cover.
  // Production sends no such header.
  headers:
    appEnv === "production"
      ? undefined
      : async () => [
          {
            source: "/:path*",
            headers: [
              { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
            ],
          },
        ],
  redirects: async () => [
    // Unpublished pages: bare and locale-prefixed forms, plus the whole
    // /for-customers subtree.
    {
      source: `/:page(${unpublishedSlugs})`,
      destination: "/",
      permanent: false,
    },
    {
      source: `/:lng(en|cs)/:page(${unpublishedSlugs})`,
      destination: "/:lng",
      permanent: false,
    },
    {
      source: "/for-customers/:path*",
      destination: "/",
      permanent: false,
    },
    {
      source: "/:lng(en|cs)/for-customers/:path*",
      destination: "/:lng",
      permanent: false,
    },
    // /jobs 301s to /careers, which is currently unpublished — the chain ends
    // at the homepage via the temporary redirect above.
    {
      source: "/jobs",
      destination: "/careers",
      permanent: true,
    },
    {
      source: "/business",
      destination: "/",
      permanent: true,
    },
    // Flaer → Tagly rebrand: the comparison pages changed slug. Both the bare
    // and the locale-prefixed forms were indexed, so both need a 301.
    {
      source: "/instagram-ads-vs-flaer",
      destination: "/instagram-ads-vs-tagly",
      permanent: true,
    },
    {
      source: "/:lng/instagram-ads-vs-flaer",
      destination: "/:lng/instagram-ads-vs-tagly",
      permanent: true,
    },
    {
      source: "/influencer-marketing-vs-flaer",
      destination: "/influencer-marketing-vs-tagly",
      permanent: true,
    },
    {
      source: "/:lng/influencer-marketing-vs-flaer",
      destination: "/:lng/influencer-marketing-vs-tagly",
      permanent: true,
    },
    {
      source: "/marketing-agencies-vs-flaer",
      destination: "/marketing-agencies-vs-tagly",
      permanent: true,
    },
    {
      source: "/:lng/marketing-agencies-vs-flaer",
      destination: "/:lng/marketing-agencies-vs-tagly",
      permanent: true,
    },
    // The standalone contact-sales page was folded into the landing page's
    // #contact section (2026-08-08). Both the bare and locale-prefixed forms
    // were linked/indexed, so both 301 to the landing anchor.
    {
      source: "/contact-sales",
      destination: "/#contact",
      permanent: true,
    },
    {
      source: "/:lng/contact-sales",
      destination: "/:lng#contact",
      permanent: true,
    },
    // The standalone support page was merged into /contact (2026-08-09). The
    // URL is baked into external support links (App Store / Meta developer
    // console point at the site's support page), so it must keep resolving —
    // bare and locale-prefixed forms 301 to the contact page.
    {
      source: "/support",
      destination: "/contact",
      permanent: true,
    },
    {
      source: "/:lng(en|cs)/support",
      destination: "/:lng/contact",
      permanent: true,
    },
    // The partners page was removed with the partners content (2026-08-08).
    {
      source: "/partners",
      destination: "/",
      permanent: true,
    },
    {
      source: "/:lng/partners",
      destination: "/:lng",
      permanent: true,
    },
  ],
};

export default nextConfig;
