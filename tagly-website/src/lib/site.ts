// APP_ENV is validated and inlined at build time by next.config.ts
// (development | staging | production). Anything non-production is treated as
// a private deploy: noindexed everywhere and disallowed in robots.txt.
export const isProduction = process.env.APP_ENV === "production";

// Canonical production origin, used for metadataBase, sitemap URLs, and
// robots.txt. Deliberately NOT env-dependent: non-production deploys are
// noindexed (X-Robots-Tag + robots.txt + robots meta) and emit no sitemap, so
// their canonicals are never consumed — one constant keeps production metadata
// correct without teaching the site its staging hostname.
export const siteOrigin = "https://www.taglyapp.com";
