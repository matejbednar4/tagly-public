import type { SupportedLanguage } from "@tagly/models/shared";
import { EMAIL_BRAND } from "../../../constants/platform/EMAIL_BRAND.js";
import { escapeEmailHtml } from "./escapeEmailHtml.js";

type RenderEmailShellOptions = {
  lang: SupportedLanguage;
  /** Document title (browser tab / some clients' header). */
  title: string;
  /** Inbox preview text — rendered hidden in the body + as a meta description. */
  preheader?: string;
  /** The template's content — already a complete centered layout table. */
  contentHtml: string;
};

/**
 * The shared document shell around every product email: doctype/head (meta,
 * Playfair @font-face, base styles), the cream canvas, and the hidden
 * preheader. Both `buildTransactionalEmailHTML` and `buildMarketingEmailHTML`
 * wrap their content in this — it owns everything that must never differ
 * between the two.
 *
 * Client notes: Apple Mail honors the @font-face (Playfair headings); Gmail
 * strips it and headings fall back to Georgia. The `<style>` block is
 * best-effort — every load-bearing style is also inlined at the call sites.
 */
export function renderEmailShell(options: RenderEmailShellOptions): string {
  const { lang, title, preheader, contentHtml } = options;
  const { COLOR, FONT, ASSETS } = EMAIL_BRAND;

  const preheaderMeta = preheader
    ? `<meta name="description" content="${escapeEmailHtml(preheader)}" />`
    : "";

  // Hidden inbox-preview text; the &nbsp;&zwnj; run pads the snippet so body
  // copy doesn't bleed into it.
  const hiddenPreheader = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${COLOR.CANVAS};opacity:0;">
        ${escapeEmailHtml(preheader)}${"&nbsp;&zwnj;".repeat(30)}
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <!-- Opt OUT of client-forced dark mode. Apple Mail and Outlook auto-invert
         mail that declares no scheme, which would flip the cream ground
         (#FFFCF2) dark and the ink masthead light — and the butter-on-ink CTA
         is the pair most at risk of becoming unreadable. The palette is warm
         and light by design, so both tags pin it to light in every client that
         honours them. -->
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    ${preheaderMeta}
    <title>${escapeEmailHtml(title)}</title>
    <style>
      @font-face {
        font-family: "Playfair Display";
        font-style: normal;
        font-weight: 600;
        src: url(${ASSETS.FONT_PLAYFAIR_SEMIBOLD_WOFF2}) format("woff2");
      }
      @font-face {
        font-family: "Playfair Display";
        font-style: normal;
        font-weight: 700;
        src: url(${ASSETS.FONT_PLAYFAIR_BOLD_WOFF2}) format("woff2");
      }
      body {
        margin: 0;
        padding: 0;
        background-color: ${COLOR.CANVAS};
        font-family: ${FONT.BODY};
      }
      a {
        color: ${COLOR.INK};
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${COLOR.CANVAS};">
    ${hiddenPreheader}
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background-color:${COLOR.CANVAS};"
    >
      <tr>
        <td align="center" style="padding:0;">
          ${contentHtml}
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
