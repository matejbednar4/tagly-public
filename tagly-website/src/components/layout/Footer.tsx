import Link from "next/link";
import Image from "next/image";
import { PressableText } from "@/components/ui/PressableText";
import { getTranslation } from "@/lib/i18n";
import { getSocialLinks } from "@/lib/social";
import { BUSINESS_APP_URL, CUSTOMER_APP_URL } from "@/lib/links";

export async function Footer({ lng }: { lng: string }) {
  const { t } = await getTranslation(lng, "footer");
  const social = getSocialLinks(lng);

  // UNPUBLISHED 2026-08-08: the For Business, Industries, Compare, and For
  // Customers sections (plus the Careers link) point at pages moved to
  // src/_unpublished pending a copy rewrite. Restore them here together with
  // the pages (see src/lib/i18n/resources.ts for the full restore checklist).
  // Their footer.{en,cs}.json keys were kept for that restore.
  const sections = [
    {
      title: t("sections.apps"),
      links: [
        // Both are OneLink templates: one URL, routed to the App Store or Play
        // Store by device. See src/lib/links.ts.
        { label: t("apps.business"), href: BUSINESS_APP_URL },
        { label: t("apps.customer"), href: CUSTOMER_APP_URL },
      ],
    },
    // /support merged into /contact (2026-08-09, 301 in next.config.ts) and
    // the "Leave your contact" (/#contact) row was dropped from the footer —
    // one Contact entry covers all of it.
    {
      title: t("sections.company"),
      links: [
        { label: t("company.about"), href: "/about" },
        { label: t("company.contact"), href: "/contact" },
      ],
    },
    {
      title: t("sections.legal"),
      links: [
        { label: t("legal.privacy"), href: "/privacy-policy" },
        { label: t("legal.terms"), href: "/terms-of-service" },
        { label: t("legal.monetization"), href: "/terms-of-monetization" },
        { label: t("legal.instagramDataDeletion"), href: "/instagram-data-deletion" },
      ],
    },
  ];

  return (
    <footer className="border-t border-divider bg-background">
      <div className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) py-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="grid grid-cols-2 gap-y-(--spacing-block-gap) sm:grid-cols-3">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="text-style-h3 text-text">{section.title}</h4>
              <ul className="mt-(--spacing-tight-gap)">
                {section.links.map((link) => (
                  <li key={link.href} className="mt-0.5 first:mt-0">
                    <PressableText
                      href={link.href}
                      className="text-style-small-body text-text after:bg-text"
                    >
                      {link.label}
                    </PressableText>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-(--spacing-block-gap) flex flex-col justify-between border-t border-divider pt-(--spacing-element-gap) sm:flex-row sm:items-center">
          <div className="flex items-center">
            <Link href={`/${lng}`} aria-label={t("aria.taglyHome")}>
              <Image src="/tagly-logo.png" alt="Tagly" width={80} height={24} />
            </Link>
            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("aria.instagram")}
              className="ml-(--spacing-element-gap) text-ink transition-opacity hover:opacity-60"
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a
              href={social.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("aria.linkedin")}
              className="ml-(--spacing-card-padding) text-ink transition-opacity hover:opacity-60"
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect width="4" height="12" x="2" y="9" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a
              href={social.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("aria.tiktok")}
              className="ml-(--spacing-card-padding) text-ink transition-opacity hover:opacity-60"
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.7a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.13z" />
              </svg>
            </a>
          </div>
          <p className="mt-(--spacing-card-padding) text-style-small-body text-text-secondary sm:mt-0">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
