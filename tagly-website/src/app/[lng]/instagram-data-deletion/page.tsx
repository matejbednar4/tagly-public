import type { Metadata } from "next";
import { Trans } from "react-i18next/TransWithoutContext";
import { legalStyles } from "@/lib/legal-styles";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "instagram-data-deletion");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/instagram-data-deletion"),
    openGraph: { title, description, images: ["/og-image.png"] },
  };
}

/**
 * Instagram's own help article on managing (and removing) connected apps.
 * Linked instead of describing Meta's UI, so this page cannot go stale when
 * Meta moves a menu. Verified live 2026-08-08: the page embeds the article
 * title "Manage the privacy settings for apps and websites that you've logged
 * into or connected on Instagram".
 */
const INSTAGRAM_APPS_HELP_URL = "https://help.instagram.com/1144624522593085/";

const SUPPORT_EMAIL = "support@taglyapp.com";

const sectionClass = legalStyles.section;
const h2Class = legalStyles.h2;
const pClass = legalStyles.p;
const ulClass = legalStyles.ul;
const olClass =
  "mt-(--spacing-element-gap) list-decimal pl-(--spacing-element-gap) text-style-body text-text";

// The three mechanisms the page describes, as anchor targets for the in-page
// nav under the heading. Anchor ids are English in both locales (site
// convention — they are part of the URL).
const mechanisms = [
  { key: "disconnect", anchor: "disconnect" },
  { key: "deauthorize", anchor: "deauthorize" },
  { key: "delete", anchor: "delete-data" },
] as const;

export default async function InstagramDataDeletionPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "instagram-data-deletion");

  const appSteps = t("app.steps", { returnObjects: true }) as string[];
  const instagramSteps = t("instagram.steps", { returnObjects: true }) as string[];
  const requestSteps = t("request.steps", { returnObjects: true }) as string[];
  const appResults = t("app.results", { returnObjects: true }) as string[];
  const requestResults = t("request.results", {
    returnObjects: true,
  }) as string[];

  return (
    <main data-no-animate>
      <section className={legalStyles.heroSection}>
        <h1 className={legalStyles.h1}>{t("hero.title")}</h1>
        <nav
          aria-label={t("nav.label")}
          className="mt-(--spacing-block-gap) flex flex-wrap"
        >
          {mechanisms.map(({ key, anchor }, index) => (
            <a
              key={key}
              href={`#${anchor}`}
              className="mr-(--spacing-tight-gap) mt-(--spacing-tight-gap) rounded-max bg-surface px-(--spacing-card-padding) py-(--spacing-tight-gap) text-style-small-body-bold text-text shadow-chip transition-colors hover:text-ink"
            >
              {index + 1}. {t(`nav.${key}`)}
            </a>
          ))}
        </nav>
      </section>

      <section id="disconnect" className={`${sectionClass} scroll-mt-(--spacing-anchor-offset)`}>
        <h2 className={h2Class}>{t("app.title")}</h2>
        <p className={pClass}>{t("app.intro")}</p>
        <ol className={olClass}>
          {appSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <p className={pClass}>{t("app.resultIntro")}</p>
        <ul className={ulClass}>
          {appResults.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className={pClass}>{t("app.note")}</p>
      </section>

      <section id="deauthorize" className={`${sectionClass} scroll-mt-(--spacing-anchor-offset)`}>
        <h2 className={h2Class}>{t("instagram.title")}</h2>
        <p className={pClass}>{t("instagram.intro")}</p>
        <ol className={olClass}>
          {instagramSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <p className={pClass}>
          <Trans
            t={t}
            i18nKey="instagram.helpText"
            components={{
              link: (
                <a
                  href={INSTAGRAM_APPS_HELP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={legalStyles.link}
                />
              ),
              email: (
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className={legalStyles.link}
                />
              ),
            }}
          />
        </p>
        <p className={pClass}>{t("instagram.note")}</p>
      </section>

      <section id="delete-data" className={`${sectionClass} scroll-mt-(--spacing-anchor-offset)`}>
        <h2 className={h2Class}>{t("request.title")}</h2>
        <p className={pClass}>{t("request.intro")}</p>
        <ol className={olClass}>
          {requestSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {/* Deliberately the SAME key as section 2 — one article-plus-support
            pointer, so the two sections can never drift apart. */}
        <p className={pClass}>
          <Trans
            t={t}
            i18nKey="instagram.helpText"
            components={{
              link: (
                <a
                  href={INSTAGRAM_APPS_HELP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={legalStyles.link}
                />
              ),
              email: (
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className={legalStyles.link}
                />
              ),
            }}
          />
        </p>
        <p className={pClass}>{t("request.resultIntro")}</p>
        <ul className={ulClass}>
          {requestResults.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className={pClass}>{t("request.note")}</p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>{t("contact.title")}</h2>
        <p className={pClass}>
          <Trans
            t={t}
            i18nKey="contact.intro"
            components={{
              email: (
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className={legalStyles.link}
                />
              ),
            }}
          />
        </p>
      </section>
    </main>
  );
}
