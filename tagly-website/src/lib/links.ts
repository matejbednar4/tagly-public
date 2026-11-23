// AppsFlyer OneLink URLs for the two apps — the v2 "tagly" templates.
//
// WHY ONELINK AND NOT DIRECT STORE LINKS: one URL serves both platforms. The
// template decides App Store vs Play Store from the visitor's device, and it
// carries install attribution through the store (nothing first-party can do
// that). It also means the Android destination is an AppsFlyer dashboard
// setting, not a value baked into this site — relevant right now, because
// production Android ships via Play's Internal Testing track, so there is no
// public Play listing to hardcode yet (see docs/DEVOPS.md).
//
// These are the PRODUCTION templates. The site has no staging deployment and no
// APP_ENV, so there is nothing to switch on; the staging twins
// (staging-tagly.onelink.me/nT6m, staging-tagly-business.onelink.me/TAsn) exist
// and must be used instead if a staging site is ever added.
//
// The legacy flaer templates (flaer.onelink.me/xSXI,
// flaerads.onelink.me/hN34) stay live in AppsFlyer for links already in the
// wild, but nothing here issues them anymore. They resolve in the BROWSER only
// — the v2 apps deliberately claim no legacy host as a universal/App link
// (decision 2026-08-01, E058).
//
// KEEP IN SYNC BY HAND: the same templates are hardcoded in
// tagly-redirect/index.html (ONELINK), tagly-join/src/lib/constants/links.ts,
// and the app configs' oneLinkHostsByEnv. See docs/LINKING_AND_REDIRECTS.md,
// which is the source of truth for the host/template inventory.

/** Customer app ("Tagly") — iOS + Android via OneLink. */
export const CUSTOMER_APP_URL = "https://tagly.onelink.me/fxW4/default";

/** Advertiser app ("Tagly Partner") — iOS + Android via OneLink. */
export const BUSINESS_APP_URL =
  "https://tagly-business.onelink.me/fBbP/default";
