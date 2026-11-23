import type { SupportedLanguage } from "@tagly/models/shared";
import { EMAIL_BRAND } from "../../../constants/platform/EMAIL_BRAND.js";

type RenderEmailFooterOptions = {
  lang: SupportedLanguage;
  /**
   * `compact` — the transactional footer: left-aligned text links only, no
   * social icons (part of the deliberately plain "note" look).
   * `full` — the marketing footer: centered, with the social-icon row.
   */
  variant: "compact" | "full";
  /** One-click unsubscribe link — always passed for marketing/promo emails. */
  unsubscribeUrl?: string;
};

/**
 * Footer copy. Exported because the plain-text alternative
 * (`buildPlainTextEmail`) mirrors this footer — one copy source keeps the two
 * MIME parts saying the same thing in both languages.
 */
export const EMAIL_FOOTER_STRINGS: Record<
  SupportedLanguage,
  {
    privacy: string;
    tos: string;
    tom: string;
    unsubscribe: string;
    manage: string;
    rights: string;
  }
> = {
  en: {
    privacy: "Privacy Policy",
    tos: "Terms of Service",
    tom: "Terms of Monetization",
    unsubscribe: "Unsubscribe",
    manage: "You can manage notifications in the Tagly app.",
    rights: "All rights reserved.",
  },
  cs: {
    privacy: "Zásady ochrany osobních údajů",
    tos: "Obchodní podmínky",
    tom: "Podmínky monetizace",
    unsubscribe: "Odhlásit odběr",
    manage: "Oznámení si můžeš spravovat v aplikaci Tagly.",
    rights: "Všechna práva vyhrazena.",
  },
};

/**
 * The shared footer both email templates end with: legal links, the
 * manage-notifications / unsubscribe line, and the copyright. The marketing
 * variant adds the social-icon row and centers everything; the transactional
 * variant stays a quiet left-aligned text block.
 */
export function renderEmailFooter(options: RenderEmailFooterOptions): string {
  const { lang, variant, unsubscribeUrl } = options;
  const { LINKS, ASSETS, COLOR, FONT } = EMAIL_BRAND;
  const t = EMAIL_FOOTER_STRINGS[lang] ?? EMAIL_FOOTER_STRINGS.en;
  const year = new Date().getFullYear();

  const align = variant === "full" ? "center" : "left";
  const linkStyle = `color:${COLOR.TEXT_TERTIARY};text-decoration:underline;`;

  const legalLinks = `
    <a href="${LINKS.PRIVACY}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${t.privacy}</a>
    &nbsp;·&nbsp;
    <a href="${LINKS.TOS}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${t.tos}</a>
    &nbsp;·&nbsp;
    <a href="${LINKS.TOM}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${t.tom}</a>
  `;

  const manageOrUnsubscribe = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${t.unsubscribe}</a>`
    : t.manage;

  const socialsRow =
    variant === "full"
      ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 16px auto;">
      <tr>
        <td style="padding:0 11px;">
          <a href="${LINKS.WEBSITE}" target="_blank" rel="noopener noreferrer">
            <img src="${ASSETS.SOCIAL_ICONS.WEBSITE}" alt="Website" width="22" style="display:block;height:auto;border:0;" />
          </a>
        </td>
        <td style="padding:0 11px;">
          <a href="${LINKS.INSTAGRAM}" target="_blank" rel="noopener noreferrer">
            <img src="${ASSETS.SOCIAL_ICONS.INSTAGRAM}" alt="Instagram" width="22" style="display:block;height:auto;border:0;" />
          </a>
        </td>
        <td style="padding:0 11px;">
          <a href="${LINKS.TIKTOK}" target="_blank" rel="noopener noreferrer">
            <img src="${ASSETS.SOCIAL_ICONS.TIKTOK}" alt="TikTok" width="22" style="display:block;height:auto;border:0;" />
          </a>
        </td>
        <td style="padding:0 11px;">
          <a href="${LINKS.LINKEDIN}" target="_blank" rel="noopener noreferrer">
            <img src="${ASSETS.SOCIAL_ICONS.LINKEDIN}" alt="LinkedIn" width="22" style="display:block;height:auto;border:0;" />
          </a>
        </td>
      </tr>
    </table>
  `
      : "";

  return `
    <div style="font-family:${FONT.BODY};text-align:${align};">
      ${socialsRow}
      <div style="font-size:12px;line-height:1.7;color:${COLOR.TEXT_TERTIARY};">
        ${legalLinks}
      </div>
      <div style="font-size:12px;line-height:1.7;color:${COLOR.TEXT_TERTIARY};margin-top:6px;">
        ${manageOrUnsubscribe}
      </div>
      <div style="font-size:11px;line-height:1.7;color:${COLOR.TEXT_TERTIARY};margin-top:10px;">
        © ${year} Flaer, Inc. ${t.rights}
      </div>
    </div>
  `;
}
