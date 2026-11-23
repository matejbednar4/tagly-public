import { EMAIL_BRAND } from "../../../constants/platform/EMAIL_BRAND.js";
import { envVariables } from "../../../environment/envVariables.js";
import { escapeEmailHtml } from "./escapeEmailHtml.js";

import type { SupportedLanguage } from "@tagly/models/shared";

type RenderEmailButtonOptions = {
  /** Which app the CTA opens — resolves to that app's OneLink for this stage. */
  app: "customer" | "advertiser";
  /** Defaults to the localized "Open Tagly" / "Open Tagly Partner" for `app`. */
  label?: string;
  /** Localizes the default label; ignored when `label` is passed. */
  lang?: SupportedLanguage;
  /**
   * `sm` — the transactional inline CTA (the "note" look).
   * `md` — the marketing card CTA. Defaults to `md`.
   */
  size?: "sm" | "md";
};

/**
 * Default CTA labels. Exported because the plain-text alternative
 * (`buildPlainTextEmail`) must render the SAME label as the HTML button — a
 * text part that disagrees with the HTML part is worse than none.
 */
export const EMAIL_CTA_LABELS: Record<
  "customer" | "advertiser",
  Record<SupportedLanguage, string>
> = {
  customer: { en: "Open Tagly", cs: "Otevřít Tagly" },
  advertiser: { en: "Open Tagly Partner", cs: "Otevřít Tagly Partner" },
};

/**
 * The stage-resolved "open the app" URL for a CTA. The single source of that
 * resolution: both the HTML button and the plain-text CTA line call this, so a
 * stage-mapping change can never leave the two parts pointing at different
 * hosts.
 */
export function resolveEmailCtaLink(app: "customer" | "advertiser"): string {
  const links =
    app === "advertiser"
      ? EMAIL_BRAND.APP_LINKS.ADVERTISER
      : EMAIL_BRAND.APP_LINKS.CUSTOMER;
  return envVariables.APP_STAGE === "production"
    ? links.production
    : links.staging;
}

/**
 * The one CTA button for email bodies — a bulletproof padded link styled like
 * the app's primary `CustomButton` (ink fill, butter label, 4px radius).
 *
 * An email CTA does exactly ONE thing: open the recipient's app (AppsFlyer
 * OneLink — the app when installed, its store listing otherwise; staging
 * emails open the staging build). There is deliberately no `href` option —
 * anything that isn't "open the app" (support, legal, unsubscribe) belongs in
 * a plain text link, not a button. Use this from notification-catalog
 * `html()` templates; never hand-roll `<a>` button styles.
 */
export function renderEmailButton(options: RenderEmailButtonOptions): string {
  const { app, label, lang = "en", size = "md" } = options;
  const { COLOR, FONT } = EMAIL_BRAND;

  const href = resolveEmailCtaLink(app);

  const resolvedLabel =
    label ?? (EMAIL_CTA_LABELS[app][lang] ?? EMAIL_CTA_LABELS[app].en);
  const padding = size === "sm" ? "12px 22px" : "14px 28px";
  const fontSize = size === "sm" ? "14px" : "15px";

  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:${COLOR.INK};color:${COLOR.BUTTER};font-family:${FONT.BODY};font-size:${fontSize};font-weight:500;line-height:1;text-decoration:none;border-radius:4px;padding:${padding};">${escapeEmailHtml(resolvedLabel)}</a>`;
}
