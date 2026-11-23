// AppsFlyer OneLink base URLs — tagly templates (2026-07-27). The legacy
// flaer templates (flaer.onelink.me/xSXI, flaerads.onelink.me/hN34, + staging
// twins) stay live in AppsFlyer for links already in the wild, but this page
// only issues the tagly ones. Note: legacy links resolve in the BROWSER only
// (OneLink page → store bounce) — the v2 apps deliberately claim no legacy
// hosts as universal/App links (decision 2026-08-01, E058), so those links no
// longer open an installed app directly.
export const CUSTOMER_ONELINK = {
  production: "https://tagly.onelink.me/fxW4/default",
  staging: "https://staging-tagly.onelink.me/nT6m/default",
} as const;

export const ADVERTISER_ONELINK = {
  production: "https://tagly-business.onelink.me/fBbP/default",
  staging: "https://staging-tagly-business.onelink.me/TAsn/default",
} as const;

// Canonical origin per env — used as Next's `metadataBase` so og:/twitter:
// image URLs resolve absolutely. Without it Next falls back to
// http://localhost:3000 and every shared link gets a dead preview image.
// (join.tagly.cz and the legacy join.flaer.* hosts also serve this page; the
// canonical one is enough for metadata.)
// Sales / "book a call" destination on the marketing site, linked from the
// drawer's business block.
// NOTE (2026-07-31): the taglyapp.com APEX has an AWS hosted zone but no A
// record, so this URL does not resolve yet (join.taglyapp.com does). The same
// is already true of the footer's /contact, /faq and /how-it-works links.
// Point this at the real page once the marketing site is live.
export const SALES_URL = "https://taglyapp.com/sales";

export const JOIN_ORIGIN = {
  production: "https://join.taglyapp.com",
  staging: "https://staging.join.tagly.dev",
} as const;
