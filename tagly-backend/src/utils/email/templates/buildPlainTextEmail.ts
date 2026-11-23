import type { SupportedLanguage } from "@tagly/models/shared";
import { EMAIL_BRAND } from "../../../constants/platform/EMAIL_BRAND.js";
import { EMAIL_SIGN_OFF } from "./buildTransactionalEmailHTML.js";
import { EMAIL_CTA_LABELS, resolveEmailCtaLink } from "./renderEmailButton.js";
import { EMAIL_FOOTER_STRINGS } from "./renderEmailFooter.js";

type BuildPlainTextEmailOptions = {
  /** Same headline the HTML part renders. */
  title?: string;
  /** The catalog `html()` body — converted to text here, never authored twice. */
  bodyHtml: string;
  /** Present on promo mail; mirrors the footer's unsubscribe link. */
  unsubscribeUrl?: string;
  /** Same CTA the HTML button renders, as a labelled URL line. */
  cta?: { app: "customer" | "advertiser" };
  lang?: SupportedLanguage;
  /** Which HTML template this accompanies — only `transactional` is signed off. */
  template: "transactional" | "marketing";
};

/** Named entities our own escaping and the catalog bodies actually emit. */
const NAMED_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&middot;": "·",
  "&ndash;": "-",
  "&mdash;": "-",
  "&hellip;": "...",
};

/**
 * Convert an email HTML body fragment to readable plain text.
 *
 * Deliberately a small purpose-built converter, not a dependency: the input is
 * only ever our own catalog `html()` output (a short fragment of `<p>`, `<a>`,
 * `<strong>`, `<br>`), so a general-purpose HTML parser would be a large new
 * supply-chain surface for a job this narrow.
 *
 * Links are kept as `text (url)` rather than dropped — a text part whose links
 * have vanished is useless to anyone actually reading it, and a body whose two
 * MIME parts disagree on content reads as evasive to spam filters.
 */
export function htmlToPlainText(html: string): string {
  return (
    html
      // Non-content blocks first, so their innards never leak into the output.
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      // Keep the destination of every link visible.
      .replace(
        /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_match, href: string, text: string) => {
          const label = text.replace(/<[^>]+>/g, "").trim();
          if (!label) return href;
          // Don't render "https://x (https://x)" when the label IS the URL.
          return label === href ? label : `${label} (${href})`;
        },
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      // Block-level closers become paragraph breaks.
      .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      // Entities last, and `&amp;` last of all, so an escaped `&amp;lt;`
      // decodes to the literal `&lt;` instead of collapsing into `<`.
      .replace(
        /&(nbsp|lt|gt|quot|#39|apos|middot|ndash|mdash|hellip);/gi,
        (match) => NAMED_ENTITIES[match.toLowerCase()] ?? match,
      )
      .replace(/&#(\d+);/g, (_m, code: string) =>
        String.fromCodePoint(Number(code)),
      )
      .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) =>
        String.fromCodePoint(parseInt(code, 16)),
      )
      .replace(/&amp;/gi, "&")
      // Tidy up: no trailing spaces, no runs of blank lines.
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * The `text` alternative shipped alongside every product email.
 *
 * Why it exists: an HTML-only message is a long-standing spam-score penalty at
 * essentially every consumer mailbox provider (iCloud notably), and it renders
 * as nothing at all in text-only clients. Every send is now `multipart` with
 * this part, generated from the SAME inputs as the HTML so the two can never
 * describe different things — the chrome (CTA label + URL, footer copy,
 * sign-off) is imported from the HTML renderers rather than restated.
 */
export function buildPlainTextEmail(
  options: BuildPlainTextEmailOptions,
): string {
  const { title, bodyHtml, unsubscribeUrl, cta, lang = "en", template } =
    options;
  const { LINKS } = EMAIL_BRAND;
  const t = EMAIL_FOOTER_STRINGS[lang] ?? EMAIL_FOOTER_STRINGS.en;

  const blocks: string[] = [];

  if (title) blocks.push(title);

  const body = htmlToPlainText(bodyHtml);
  if (body) blocks.push(body);

  if (cta) {
    const label =
      EMAIL_CTA_LABELS[cta.app][lang] ?? EMAIL_CTA_LABELS[cta.app].en;
    blocks.push(`${label}: ${resolveEmailCtaLink(cta.app)}`);
  }

  // The marketing template has no sign-off, so its text twin doesn't get one.
  if (template === "transactional") {
    blocks.push(EMAIL_SIGN_OFF[lang] ?? EMAIL_SIGN_OFF.en);
  }

  blocks.push("--");
  blocks.push(
    [
      `${t.privacy}: ${LINKS.PRIVACY}`,
      `${t.tos}: ${LINKS.TOS}`,
      `${t.tom}: ${LINKS.TOM}`,
    ].join("\n"),
  );
  blocks.push(
    unsubscribeUrl ? `${t.unsubscribe}: ${unsubscribeUrl}` : t.manage,
  );
  blocks.push(`© ${new Date().getFullYear()} Flaer, Inc. ${t.rights}`);

  return blocks.join("\n\n");
}
