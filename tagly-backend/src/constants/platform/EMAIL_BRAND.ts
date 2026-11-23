/**
 * Email branding — the single source of truth for everything the email
 * templates render as chrome: outbound links, hosted assets, and the
 * email-safe subset of the v2 design tokens.
 *
 * The palette MIRRORS the cream theme in `tagly-shared/client/theme/theme.ts`. The
 * backend must not import `@tagly/client` (a React Native package), so the hex
 * values are duplicated here on purpose — if a token changes there, update it
 * here too.
 *
 * ✅ ALL hosted assets are live as of 2026-08-02 (E026 closed) — verified by
 * byte-comparing the CDN response against the source file on BOTH
 * assets.taglyapp.com and the legacy assets.flaer.app.
 *
 * Two things a future edit must not undo:
 *
 * 1. `LOGO_INK_URL` is the Tagly **lockup** (mark + wordmark), ink #382724 on
 *    transparent, 1067×318 (3.36:1). Its siblings on the same prefix —
 *    `brand/textLogos/{black,white,orange}.png` — are the OLD FLAER wordmark
 *    and must never be substituted or "recolored" into it. Because the lockup
 *    is wide, the three render sites size it at 140–160px, NOT the ~76–96px
 *    that suited a square mark; dropping those widths back makes the wordmark
 *    illegible.
 * 2. The two Playfair woff2 subsets union latin + latin-ext into ONE file per
 *    weight, because the @font-face below declares no `unicode-range` —
 *    separate per-range files would silently drop Czech diacritics to Georgia.
 *    The local sources (`ops/email-assets/`, incl. `subset-playfair.sh`) were
 *    removed after upload — recover from git history (`git show 14131db5`)
 *    if a regeneration is ever needed.
 */
export const EMAIL_BRAND = {
  /**
   * Public links rendered in email footers.
   * ⚠️ Cutover dependency: the marketing site (separate repo) must serve
   * taglyapp.com — incl. /privacy-policy, /terms-of-service,
   * /terms-of-monetization — before this ships. Social handles are renamed by
   * the team in the respective platforms; update here when they change.
   */
  LINKS: {
    WEBSITE: "https://www.taglyapp.com",
    INSTAGRAM: "https://www.instagram.com/tagly_cz",
    TIKTOK: "https://www.tiktok.com/@tagly.cz",
    LINKEDIN: "https://www.linkedin.com/company/taglyapp",
    PRIVACY: "https://www.taglyapp.com/privacy-policy",
    TOS: "https://www.taglyapp.com/terms-of-service",
    TOM: "https://www.taglyapp.com/terms-of-monetization",
  },

  /**
   * Email CTA targets — the ONLY destination an email CTA button may have
   * (see `renderEmailButton`): the first-party "open the app" route on the
   * redirect hosts (`tagly-redirect/index.html`, `/open` paths). Switched
   * from raw OneLink URLs 2026-08-05 for deliverability: every link in a
   * Tagly email is now on a Tagly-owned domain (link-domain ≙ brand domain;
   * `onelink.me` is shared with every AppsFlyer customer).
   *
   * Behavior: the hosts are claimed universal-link domains (AASA paths
   * `/customer/*` + `/advertiser/*`), so with the app installed an iOS tap
   * opens it directly — no browser hop (the apps' `+native-intent` routes the
   * unmatched path to home). Without the app / on Android / desktop, the
   * redirect page bounces to the app's AppsFlyer OneLink (app-or-store +
   * attribution). The OneLink URLs themselves now live in
   * `tagly-redirect/index.html` (`ONELINK`) and `tagly-join`'s links — the
   * legacy flaer OneLink templates stay live in AppsFlyer, browser-only, per
   * E058.
   *
   * ⚠️ Deploy order: the redirect page's `/open` route (tagly-redirect) must
   * be deployed to an env BEFORE this backend version sends email there.
   *
   * Keyed by deploy stage; `development` resolves to staging (matches the
   * OneLink stage mapping — no dev template).
   */
  APP_LINKS: {
    CUSTOMER: {
      production: "https://redirect.taglyapp.com/customer/open",
      staging: "https://staging.redirect.tagly.dev/customer/open",
    },
    ADVERTISER: {
      production: "https://redirect.taglyapp.com/advertiser/open",
      staging: "https://staging.redirect.tagly.dev/advertiser/open",
    },
  },

  /**
   * Hosted assets referenced from email HTML (data: URIs are stripped by Gmail).
   * Served from assets.taglyapp.com — its own CloudFront distribution
   * (E3SXHIBPD24BCC) over the SAME S3 bucket as the legacy assets.flaer.app
   * distro (which stays live for links in already-sent emails).
   */
  ASSETS: {
    /**
     * Ink (#382724) Tagly lockup — mark + wordmark, transparent, 1067×318.
     * ⚠️ The `black`/`white`/`orange` files beside it are the FLAER wordmark;
     * never swap one in. Rendered at 140–160px (it is 3.36:1, so the old
     * ~76–96px sizing left the word unreadable).
     */
    LOGO_INK_URL: "https://assets.taglyapp.com/brand/textLogos/ink.png",
    SOCIAL_ICONS: {
      WEBSITE: "https://assets.taglyapp.com/icons/website-link.png",
      INSTAGRAM: "https://assets.taglyapp.com/thirdParty/instagram.png",
      TIKTOK: "https://assets.taglyapp.com/thirdParty/tiktok.png",
      LINKEDIN: "https://assets.taglyapp.com/thirdParty/linkedin.png",
    },
    /** Playfair Display subsets (latin + latin-ext) — uploaded 2026-08-02. */
    FONT_PLAYFAIR_SEMIBOLD_WOFF2:
      "https://assets.taglyapp.com/fonts/playfair-semibold.woff2",
    FONT_PLAYFAIR_BOLD_WOFF2:
      "https://assets.taglyapp.com/fonts/playfair-bold.woff2",
  },

  /** Cream-theme tokens, flattened to email-safe solid hexes. */
  COLOR: {
    /** color.background — the canvas behind every email. */
    CANVAS: "#FFFCF2",
    /** color.surface — the marketing card fill. */
    SURFACE: "#FFFFFF",
    /** color.ink — all text + the CTA fill. */
    INK: "#382724",
    /** color.brand (butter) — badge fill + CTA label (color.on.ink). */
    BUTTER: "#FFF3B0",
    /** color.success — money figures ONLY (amounts, earnings), per the design system. */
    SUCCESS: "#3F9B6E",
    /** color.text.secondary — supporting copy. */
    TEXT_SECONDARY: "#8A6F5F",
    /** color.text.tertiary — footer text and links. */
    TEXT_TERTIARY: "#B59A7E",
    /** border.divider (10% ink) pre-flattened onto the cream canvas — email
     *  clients are unreliable with rgba, so ship the solid equivalent. */
    DIVIDER: "#EBE6DD",
  },

  /** Warm shadows (cream-theme `shadow.card` equivalent). Browser pages only
   *  — the unsubscribe page. Email templates no longer use box-shadow (Gmail
   *  strips it; the marketing card is closed by a DIVIDER hairline instead). */
  SHADOW: {
    CARD: "0 1px 2px rgba(56,39,36,0.10), 0 4px 14px rgba(56,39,36,0.07)",
  },

  /**
   * Font stacks. Playfair loads via @font-face where supported (Apple Mail);
   * Gmail strips webfonts, so headings degrade to Georgia — an intentional,
   * still-warm serif fallback. Body and money always use the system stack
   * (Stack Sans never ships to email).
   */
  FONT: {
    HEADING:
      "'Playfair Display', Georgia, 'Times New Roman', serif",
    BODY: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
};
