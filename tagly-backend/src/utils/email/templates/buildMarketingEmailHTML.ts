import type { SupportedLanguage } from "@tagly/models/shared";
import { EMAIL_BRAND } from "../../../constants/platform/EMAIL_BRAND.js";
import { escapeEmailHtml } from "./escapeEmailHtml.js";
import { renderEmailButton } from "./renderEmailButton.js";
import { renderEmailFooter } from "./renderEmailFooter.js";
import { renderEmailShell } from "./renderEmailShell.js";

type BuildMarketingEmailOptions = {
  /** Visible headline inside the masthead (Playfair, reversed on ink). */
  title?: string;
  /** Inbox preview text (hidden in body). */
  preheader?: string;
  /** Main body (already HTML — catalog `html()` output), rendered inside the card. */
  bodyHtml: string;
  /** One-click unsubscribe — REQUIRED for promo sends (CAN-SPAM); the worker passes it. */
  unsubscribeUrl?: string;
  /** When present, the card ends with the standard open-the-app CTA button. */
  cta?: { app: "customer" | "advertiser" };
  /** Optional butter overline above the headline (e.g. "This week in Tampa"). */
  badge?: string;
  lang?: SupportedLanguage;
};

/**
 * The MARKETING email template — "the ink masthead" (design B, 2026-08-05,
 * replacing the shadow-based postcard: Gmail strips `box-shadow`, so the old
 * card rendered edgeless for most recipients). The app translated to email:
 * cream canvas, the ink wordmark lockup, then one card whose header is a
 * solid ink block (uppercase butter overline + cream Playfair headline
 * reversed on it) and whose white body hangs off it, closed by a DIVIDER
 * hairline — solid fills and a 1px border render identically in Gmail,
 * Outlook (which squares the corners, acceptable), and Apple Mail. Body copy
 * is left-aligned; the CTA is centered. Promo/marketing sends only —
 * everything operational uses `buildTransactionalEmailHTML`. Shares the
 * shell, footer, and tokens with it via `renderEmailShell` /
 * `renderEmailFooter` / `EMAIL_BRAND`.
 *
 * Layout note: the ink block is a deliberate email-only exception to the
 * app's 60/30/10 color rule — in mail, structure has to come from solid
 * fills, and the masthead doubles as the card's definition. When neither
 * `title` nor `badge` is present the masthead is skipped and the body
 * renders as a plain hairline card (in practice `sendEmail` defaults `title`
 * to the subject, so the masthead always renders on real sends).
 */
export function buildMarketingEmailHTML(
  options: BuildMarketingEmailOptions,
): string {
  const {
    title,
    preheader,
    bodyHtml,
    unsubscribeUrl,
    cta,
    badge,
    lang = "en",
  } = options;
  const { COLOR, FONT, ASSETS } = EMAIL_BRAND;

  const ctaHtml = cta
    ? `<div style="text-align:center;padding-top:22px;">${renderEmailButton({ app: cta.app, lang, size: "md" })}</div>`
    : "";

  const overlineHtml = badge
    ? `<div style="font-family:${FONT.BODY};font-size:11px;font-weight:500;line-height:1;letter-spacing:2px;text-transform:uppercase;color:${COLOR.BUTTER};padding-bottom:${title ? "12px" : "0"};">
        ${escapeEmailHtml(badge)}
      </div>`
    : "";

  const headingHtml = title
    ? `<h1 style="font-family:${FONT.HEADING};font-size:24px;font-weight:700;line-height:1.25;color:${COLOR.CANVAS};margin:0;">
        ${escapeEmailHtml(title)}
      </h1>`
    : "";

  const hasMasthead = Boolean(overlineHtml || headingHtml);

  // The ink masthead (rounded top) + the white body closed by a hairline
  // (rounded bottom). Without a masthead the body is a full hairline card.
  const mastheadHtml = hasMasthead
    ? `<table
        role="presentation"
        cellspacing="0"
        cellpadding="0"
        border="0"
        width="100%"
        style="background-color:${COLOR.INK};border-radius:8px 8px 0 0;"
      >
        <tr>
          <td style="padding:28px 28px 24px 28px;text-align:center;">
            ${overlineHtml}
            ${headingHtml}
          </td>
        </tr>
      </table>`
    : "";

  const bodyBorder = hasMasthead
    ? `border:1px solid ${COLOR.DIVIDER};border-top:0;border-radius:0 0 8px 8px;`
    : `border:1px solid ${COLOR.DIVIDER};border-radius:8px;`;

  const contentHtml = `
    <table
      role="presentation"
      cellspacing="0"
      cellpadding="0"
      border="0"
      width="100%"
      style="max-width:600px;width:100%;"
    >
      <tr>
        <td align="center" style="padding:32px 16px 0 16px;">
          <a href="${EMAIL_BRAND.LINKS.WEBSITE}" target="_blank" rel="noopener noreferrer">
            <img
              src="${ASSETS.LOGO_INK_URL}"
              alt="Tagly"
              width="160"
              style="max-width:160px;height:auto;display:inline-block;border:0;"
            />
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 16px 0 16px;">
          ${mastheadHtml}
          <table
            role="presentation"
            cellspacing="0"
            cellpadding="0"
            border="0"
            width="100%"
            style="background-color:${COLOR.SURFACE};${bodyBorder}"
          >
            <tr>
              <td style="padding:30px 28px;text-align:left;">
                <div style="font-family:${FONT.BODY};font-size:15px;line-height:1.6;color:${COLOR.INK};">
                  ${bodyHtml}
                </div>
                ${ctaHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px 24px 24px;">
          ${renderEmailFooter({ lang, variant: "full", unsubscribeUrl })}
        </td>
      </tr>
    </table>
  `;

  return renderEmailShell({
    lang,
    title: title ?? "Tagly",
    preheader,
    contentHtml,
  });
}
