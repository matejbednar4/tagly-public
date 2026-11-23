# Linking & Redirects

This document describes every surface that opens an app or redirects a browser,
as of v2.0.0 (post the 2026-08-05 email-CTA rework). Its sibling
[REFERRAL_ATTRIBUTION.md](REFERRAL_ATTRIBUTION.md) covers what rides on top of
these rails (codes, stickers, attribution); this doc covers the rails
themselves.

## The big picture

> **Naming note (decision 2026-08-10):** the business app is branded **"Tagly Partner"**, but every
> technical identifier below deliberately keeps `tagly-business` — the schemes and the OneLink
> subdomains/templates. They were frozen at v2 launch: renaming them would invalidate the
> device-verified AASA/App Links/attribution setup for no user-visible benefit (schemes are never
> user-facing, and OneLink hosts hide behind buttons/QRs). Don't rename them to match the brand.

Five layers, each forced by a different constraint. None can do another's job:

| Layer | What it is | Who hits it | Why it exists |
| --- | --- | --- | --- |
| **Schemes** (`tagly://`, `tagly-business://`) | custom URL schemes registered by the apps | only web pages' JS — never typed, mailed, or printed | the only way a webpage can launch the app; not shareable (dead-ends without the app, stripped by Gmail) |
| **Universal/App links** | https URLs on domains the apps claim (AASA / assetlinks) | the OS, at tap time | makes an https link open the installed app with **no browser hop** |
| **Redirect page** (`tagly-redirect/`) | one static page on the `redirect.*` hosts | machines: Meta + Stripe redirect URIs, email CTAs as fallback | protocol glue — a stable https host third parties are registered against, translating URLs into app opens |
| **Join page** (`tagly-join/`) | standalone Next.js landing on the `join.*` hosts | humans: QR sticker scans, referral links | a real marketing landing that explains Tagly and carries the referral code |
| **OneLink** (AppsFlyer) | `*.onelink.me` templates | fallback hops and fresh installs | the app-or-store decision + **install attribution** (carrying a referral code through an App Store install — nothing first-party can do this) |

**The 2026-08-05 shape:** OneLink was demoted from "the email CTA" to "the
fallback + install-attribution layer". Every link in a Tagly email is now
first-party; OneLink is reached only when a first-party surface hands off to it.

## Host & scheme inventory

### Hosts (per environment)

| Surface | development | staging | production |
| --- | --- | --- | --- |
| Redirect | `dev.redirect.tagly.dev` | `staging.redirect.tagly.dev` | `redirect.taglyapp.com` |
| Join | — | `staging.join.tagly.dev` | `join.taglyapp.com` + `join.tagly.cz` (printed sticker domain) |
| OneLink customer | — (uses staging) | `staging-tagly.onelink.me/nT6m` | `tagly.onelink.me/fxW4` |
| OneLink advertiser | — (uses staging) | `staging-tagly-business.onelink.me/TAsn` | `tagly-business.onelink.me/fBbP` |
| **Legacy (kept resolving, nothing emits them)** | `dev.redirect.flaer.app` | `staging.redirect.flaer.app` | `redirect.flaer.app`, `join.flaer.cz`, `join.flaer.app`, `flaer.onelink.me/xSXI`, `flaerads.onelink.me/hN34` |

Redirect hosts: `redirectHostByEnv` in both app configs; backend
`REDIRECT_BASE_URL` (`environment/envVariables.ts`).
Join hosts: `joinHostsByEnv` (customer config) + `JOIN_ORIGIN`
(`tagly-join/src/lib/constants/links.ts`). OneLink templates are hardcoded in
**three standalone places that must stay in sync by hand**:
`tagly-redirect/index.html` (`ONELINK`), `tagly-join/src/lib/constants/links.ts`,
and the app configs' `oneLinkHostsByEnv` (hosts only).

### Schemes (per environment)

| App | development | staging | production |
| --- | --- | --- | --- |
| Customer | `tagly-dev` | `tagly-staging` | `tagly` |
| Advertiser | `tagly-business-dev` | `tagly-business-staging` | `tagly-business` |
| Admin | `tagly-admin-dev` | `tagly-admin-staging` | `tagly-admin` (registered, **nothing emits it**) |

The apps register **only** the tagly-family schemes (`schemes` in each
`app.config.ts`). The old flaer-family schemes (`flaer`, `flaer-ads` + env
variants) lived only inside v1 builds, which are retired behind the min-version
wall; nothing emits them any more (the redirect page dropped its
`LEGACY_SCHEMES` table at the v1 cutover, 2026-08-31).

## Universal links (iOS) and App Links (Android)

### What each app claims

| Claim | Customer | Advertiser |
| --- | --- | --- |
| `applinks:` redirect host (own env) | ✅ | ✅ |
| `applinks:` join hosts | ✅ (staging + prod) | ❌ — join links always open the **customer** app |
| `applinks:` own OneLink host | ✅ | ✅ |
| `webcredentials:` redirect host | ✅ (needed for `openAuthSessionAsync` on iOS 17.4+) | ✅ |

Per-env claiming only — a staging build claims staging hosts, never prod ones
(a build claiming both can open the "wrong" app). `iosAssociatedDomainsByEnv`
in each `app.config.ts`. Admin claims nothing.

### The association files

Served from each host's repo (`tagly-redirect/.well-known/`,
`tagly-join/public/.well-known/`), Team ID `S9BP8HQZ93`, the frozen
`com.flaer.*` bundle ids (keep-list):

- **Redirect host AASA**: `/customer/*` → the three customer bundle ids,
  `/advertiser/*` → the three advertiser ids. **Path-partitioned** — this is
  what lets both apps share one host. `webcredentials` lists all six.
- **Join host AASA**: `paths: ["*"]`, customer ids only. Any join-host URL
  opens the customer app when installed.
- **assetlinks.json** on both hosts: the same six packages with release +
  (where applicable) debug signing fingerprints.

**Serving mechanics (sharp edge, documented in
`tagly-redirect/.well-known/README.md`):** Amplify 301s extensionless paths
before header config runs, and Apple's AASA fetcher does not follow redirects —
so both repos ship the file twice (`apple-app-site-association` +
`…​.json`) and a **console-side rewrite** (`amplify-custom-rules.json`) maps the
extensionless path to the `.json` with a 200, while `customHttp.yml` forces
`Content-Type: application/json`. iOS caches associations at install time via
Apple's CDN — a broken AASA is invisible until fresh installs stop deep-linking.

### Android verification status

| Host filter | `autoVerify` | Effect |
| --- | --- | --- |
| Join hosts | ✅ | verified App Links — direct app open |
| OneLink hosts | ✅ | verified — direct app open |
| Redirect host (`pathPrefix /customer/` resp. `/advertiser/`) | ❌ | **not verified** — an Android tap goes to the browser (the redirect page), which then bounces via scheme/OneLink |

The redirect-host filter predates the email-CTA use; `assetlinks.json` is
already deployed there, so flipping `autoVerify` on is possible if the extra
browser hop on Android ever matters. It was left off deliberately for the
OAuth flows (Android IG auth runs in an in-app WebView precisely to keep
navigation in-page).

## The redirect page (`tagly-redirect/index.html`)

One static page, no build step, deployed once with multiple custom domains.
Everything it does derives from the URL:

1. **Hostname → environment** (`envFromHost`): exact-match table for the three
   tagly hosts and the three legacy flaer hosts (kept resolving per the
   additive-migration rule); unknown hosts default to production.
2. **Scheme family**: one table, the tagly-* schemes, on every host — a link
   that reaches a legacy flaer host is bounced into the same tagly scheme,
   because that is the only app a user can have since the v1 cutover.
3. **Path → behavior** (`/{app}[/{env}]/{rest}`; an env segment in the path
   overrides the host env — accepted for very old shipped URIs, nothing
   current emits it):

| Path class | Emitted by | Behavior |
| --- | --- | --- |
| `/customer/open`, `/advertiser/open` | email CTAs (`EMAIL_BRAND.APP_LINKS`) | scheme attempt at app root → after 2.5 s, `location.replace` to that app's **OneLink** (app-or-store). The one path class that navigates away. |
| `/customer/instagram/oauth` | v2 IG OAuth (`CUSTOMER_APP_INSTAGRAM_OAUTH_REDIRECT_URI`) | scheme bounce with path + query preserved; **never navigates away** |
| `/customer/withdraw` | v2 Stripe Connect return **and** refresh (`CUSTOMER_APP_WITHDRAW_RETURN_URI`) | same |
| anything else (e.g. a path a retired v1 backend once emitted) | nothing current | bounced verbatim into the app scheme; the app decides |

**The no-web-fallback rule (decision 2026-08-04):** mid-flow returns (OAuth,
Stripe) never navigate anywhere — everyone reaching them has the app by
definition, and the old 1 s bounce used to fire while iOS was still showing its
"Open in Tagly?" prompt. They hold the loading state and reveal a manual
"Open the Tagly app" link after 2.5 s. **The `/open` paths are the single
deliberate exception (2026-08-05)**: email recipients may not have the app, so
they fall back to OneLink.

**Mechanics** (`tryOpen`): hidden-iframe scheme fire + `location.href` at
50 ms → at 2.5 s either the OneLink fallback (`/open`) or the manual reveal
(mid-flow); a `visibilitychange` → hidden (the app took over) cancels the
follow-up. `isAllowedRoute` only constrains the app segment — `rest` is
deliberately unrestricted because the page can only ever emit first-party
schemes (no open-redirect surface; the backend auth/ownership checks are the
real boundary).

## Email CTAs — the `/open` flow

`renderEmailButton` (backend) builds exactly one kind of CTA: open the
recipient's app. Href comes from `EMAIL_BRAND.APP_LINKS` — the first-party
`/open` URLs (switched from raw OneLink 2026-08-05: link-domain ≙ brand
domain; `onelink.me` is shared with every AppsFlyer customer).

```
tap in email
 ├─ iOS, app installed ──────────────► app opens directly (universal link;
 │                                     +native-intent routes the path to home)
 ├─ iOS no app / webview mail client ► redirect page → scheme attempt
 │                                     → 2.5s → OneLink → App Store (attributed)
 ├─ Android ─────────────────────────► browser → redirect page → scheme attempt
 │                                     (works if installed) → 2.5s → OneLink
 │                                     → app or Play Store
 └─ desktop ─────────────────────────► redirect page → 2.5s → OneLink → its
                                       desktop fallback
```

**⚠️ Deploy-order invariant:** the redirect page's `/open` route must be live
in an environment BEFORE a backend that sends email there — otherwise the CTA
lands on a page that scheme-bounces to `tagly://open` with no fallback. Stated
in `EMAIL_BRAND.ts`; both changes shipped on the same branch.

## In-app handling of incoming links

- **`+native-intent.tsx`** (customer + advertiser, identical): any incoming
  path that isn't a known route group returns `"/"` — i.e. **today, every
  inbound link lands on home**. This is deliberate: per-screen deep-link
  routing was deferred (see FUTURE.md "Push notification deep-linking"); when
  it lands, extending this one file (map `/customer/<rest>` → `/<rest>`) makes
  every emailed/printed path deep-linkable with no new infrastructure. Known
  consequence: the `tagly://withdraw` cold-start return lands on home instead
  of the withdraw screen (tracked in v2-review findings).
- **OAuth/Stripe returns don't ride routing at all**: iOS captures them inside
  `WebBrowser.openAuthSessionAsync(url, returnUri)` (IG OAuth:
  `useInstagramAuthFlow`; Connect: `withdraw/index.tsx`); Android IG auth uses
  an in-app WebView watching for the redirect URI. The redirect page is the
  target those sessions watch for.
- **Push taps carry no navigation** — `usePushOpenedListener` is
  analytics-only (`push_opened { slug }`), by decision, until open-rate data
  says which destinations matter.
- **Business page links** (`Link` model — website/menu/reservation URLs on a
  business) are plain external URLs, Safe-Browsing-checked and admin-approved
  (`utils/moderation/upsertLink.ts`, `reviewLink.ts`); they open in an
  in-app browser, never deep-link.

## v1 legacy surfaces — cutover status

The v1 forced cutover happened 2026-08-31 (v1 backend + the flaer scheme
emission deleted; sign-off per the root CLAUDE.md keep-list). Decision E058
(2026-08-01) already made the legacy OneLink hosts browser-only: the apps claim
no flaer host as a universal/App link, so old links resolve in the browser but
never open an app directly.

| Surface | Status |
| --- | --- |
| `LEGACY_SCHEMES` (flaer-* family) + the `*.flaer.app` hostname test | **Removed** from `tagly-redirect/index.html` — every host emits the tagly schemes |
| flaer host → env branches in `envFromHost` | **Kept** (additive-migration rule: the hosts keep resolving) |
| flaer.app custom domains on the redirect Amplify app | **Kept attached** — zero cost, keeps old links resolving; detaching is its own signed-off step |
| `LEGACY_REDIRECT_BASE_URL` + derived v1 URLs, `DASHBOARD_ORIGIN`, `ADMIN_ORIGIN`, `LEGACY_CUSTOMER_APP_INSTAGRAM_OAUTH_REDIRECT_URI` | **Removed** from `tagly-backend/src/environment/envVariables.ts` |
| flaer IG OAuth redirect URIs registered in the Meta console | No client bakes them any more; removing them from the console is a pending devops step (Matej) |
| Legacy join hosts accepted as referral sources (`join.flaer.cz`, `join.flaer.app`) | **Kept** — `tagly-shared/client/services/attribution/parseInboundReferral.ts` (old printed stickers/links) |
| Legacy OneLink templates (`flaer.onelink.me/xSXI`, `flaerads.onelink.me/hN34` + staging twins) | **Kept** — AppsFlyer dashboard only, browser-only bounce; retire needs sign-off |

## Known gaps / flagged inconsistencies

Documented so nobody rediscovers them; none are silent breakage:

1. **Redirect-host Android App Links not verified** (`autoVerify` off) — the
   email CTA on Android takes the browser hop. Fixable config-side; see above.
2. **`+native-intent` routes everything to home** — deferred deep-link routing
   (FUTURE.md). `tagly://withdraw` cold-start lands on home.
3. **Join page env resolver inverts the dev fallback**: `buildJoinUrls.ts`
   maps `APP_ENV=development` → **production** OneLink, while the backend
   email button and the redirect page both map development → **staging**. Two
   mirrored constant sets, opposite behavior for the same input — align if the
   dev join page is ever pointed at real testers.
4. **Join hosts claimed by the customer app only, `paths: ["*"]`** — an
   advertiser referral link on a join host opens the *customer* app when
   installed; `parseInboundReferral` compensates client-side. Load-bearing,
   not accidental.
5. **`tagly-admin` registers `tagly-admin://` that nothing emits** — harmless
   dead registration.
6. **`EMAIL_BRAND.LINKS.INSTAGRAM` still points at the flaer IG handle** —
   updated in-platform by the team; update the constant when the handle
   renames (the LinkedIn handle is correct as-is per keep-list).

---

## Canonical domains (decided 2026-08-10 — flip AFTER prod website + join are live)

One canonical production host per surface; every legacy host 308-redirects to it
with the **full path + query preserved** (referral codes on printed QR stickers
and shared join links must survive the hop). The **redirect page is the explicit
exception — it never redirects**: Meta + Stripe are registered against exact
hosts and the page picks its scheme family per hostname, so
`redirect.flaer.app` and `redirect.taglyapp.com` both keep serving `main`
forever (already the live state).

| Surface | Canonical | Legacy hosts → 308 to canonical |
| --- | --- | --- |
| Website | `taglyapp.com` | `www.taglyapp.com`, `flaer.app`, `www.flaer.app`, `tagly.cz`, `www.tagly.cz` |
| Join | `join.taglyapp.com` | `join.flaer.app`, `join.flaer.cz`, `join.tagly.cz` |
| Redirect page | — | **none, ever** (dual-hosted by design) |

**Mechanism.** Amplify custom rules cannot match on hostname (all domains on an
app serve identical content), so the redirect lives in each app's Next
middleware (`tagly-website/src/middleware.ts`, `tagly-join/src/middleware.ts`):
it fires only when (a) the `CANONICAL_HOST` env var was baked into the build
(Amplify console var → `.env.production` via `amplify.yml`) **and** (b) the
request Host is on the file's explicit legacy-host allowlist — so staging hosts
can never match, and with the var unset the middleware is a no-op. Website
caveat: the middleware matcher skips assets/`sitemap.xml`/`robots.txt`, so only
page routes redirect — fine for the brand flip, and sitemaps are per-host
anyway.

**Flip procedure (per app, prod only, after the new prod deploys are verified):**

1. Amplify console → app → env var `CANONICAL_HOST=taglyapp.com` (website) /
   `join.taglyapp.com` (join). App-level is safe (the allowlist protects
   staging), but prefer a `main`-branch override for hygiene.
2. Redeploy `main` (env vars are build-time). Verify: `curl -sI
   https://flaer.app/x?y=1` → `308` + `location: https://taglyapp.com/x?y=1`,
   and the canonical host still `200`s.
3. Still pending before the website flip covers `tagly.cz`: a (zero-cost)
   domain association for `tagly.cz` + `www` on the website app — it is
   attached nowhere today.

**Consequences, accepted:** the flip finalizes the flaer.app → Tagly brand
cutover (old marketing site disappears behind a 308); shipped app builds and
ASC-registered legal URLs emit `www.taglyapp.com` and take one 308 hop until
`WEBSITE_ORIGIN` moves to the apex in a later release; legacy hosts stay
attached and redirecting forever per the additive-migration rule — removal
requires Matej's explicit sign-off, never bundled.
