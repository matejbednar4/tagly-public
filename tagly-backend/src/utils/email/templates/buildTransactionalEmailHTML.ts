import type { SupportedLanguage } from "@tagly/models/shared";
import { EMAIL_BRAND } from "../../../constants/platform/EMAIL_BRAND.js";
import { escapeEmailHtml } from "./escapeEmailHtml.js";
import { renderEmailButton } from "./renderEmailButton.js";
import { renderEmailFooter } from "./renderEmailFooter.js";
import { renderEmailShell } from "./renderEmailShell.js";

type BuildTransactionalEmailOptions = {
  /** Visible headline in the email body (Playfair). Omit for headline-less mail. */
  title?: string;
  /** Inbox preview text (hidden in body). */
  preheader?: string;
  /** Main body (already HTML — catalog `html()` output). */
  bodyHtml: string;
  /** Rendered in the footer when present (edge case — promo forced onto this template). */
  unsubscribeUrl?: string;
  /** When present, the note ends with the standard open-the-app CTA button. */
  cta?: { app: "customer" | "advertiser" };
  lang?: SupportedLanguage;
};

/**
 * The note's sign-off. Exported because the plain-text alternative
 * (`buildPlainTextEmail`) reproduces it for transactional mail — the marketing
 * template has no sign-off, so the text part omits it there too.
 */
export const EMAIL_SIGN_OFF: Record<SupportedLanguage, string> = {
  en: "The Tagly team",
  cs: "Tým Tagly",
};

/**
 * The TRANSACTIONAL email template — "the note". Deliberately plain: a flat
 * cream page, no card or masthead, a narrow left-aligned column that reads
 * like a short personal note signed by the team. Used for everything
 * operational (OTP, payouts, account/state changes, admin blasts) — the
 * expressive counterpart is `buildMarketingEmailHTML` (promo only). Shares the
 * shell, footer, and tokens with it via `renderEmailShell`/`renderEmailFooter`/
 * `EMAIL_BRAND`.
 */
export function buildTransactionalEmailHTML(
  options: BuildTransactionalEmailOptions,
): string {
  const { title, preheader, bodyHtml, unsubscribeUrl, cta, lang = "en" } =
    options;
  const { COLOR, FONT, ASSETS } = EMAIL_BRAND;

  const ctaHtml = cta
    ? `<div style="margin-top:24px;">${renderEmailButton({ app: cta.app, lang, size: "sm" })}</div>`
    : "";

  const headingHtml = title
    ? `<h1 style="font-family:${FONT.HEADING};font-size:22px;font-weight:600;line-height:1.3;color:${COLOR.INK};margin:28px 0 12px 0;">
        ${escapeEmailHtml(title)}
      </h1>`
    : "";

  const contentHtml = `
    <table
      role="presentation"
      cellspacing="0"
      cellpadding="0"
      border="0"
      width="100%"
      style="max-width:560px;width:100%;"
    >
      <tr>
        <td style="padding:40px 24px 24px 24px;text-align:left;">
          <a href="${EMAIL_BRAND.LINKS.WEBSITE}" target="_blank" rel="noopener noreferrer">
            <img
              src="${ASSETS.LOGO_INK_URL}"
              alt="Tagly"
              width="140"
              style="max-width:140px;height:auto;display:inline-block;border:0;"
            />
          </a>
          ${headingHtml}
          <div style="font-family:${FONT.BODY};font-size:16px;line-height:1.65;color:${COLOR.INK};">
            ${bodyHtml}
          </div>
          ${ctaHtml}
          <div style="margin-top:26px;font-family:${FONT.HEADING};font-size:18px;font-weight:600;color:${COLOR.INK};">
            ${EMAIL_SIGN_OFF[lang] ?? EMAIL_SIGN_OFF.en}
          </div>
          <div style="border-top:1px solid ${COLOR.DIVIDER};margin:30px 0 18px 0;font-size:0;line-height:0;">&nbsp;</div>
          ${renderEmailFooter({ lang, variant: "compact", unsubscribeUrl })}
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
