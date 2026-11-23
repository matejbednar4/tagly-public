import type { Metadata } from "next";
import { Trans } from "react-i18next/TransWithoutContext";
import { PressableText } from "@/components/ui/PressableText";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "careers");

  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: buildAlternates(lng, "/careers"),
    openGraph: { title: t("meta.ogTitle"), description: t("meta.description") },
  };
}

export default async function CareersPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "careers");

  return (
    <main>
      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pt-(--spacing-section-gap) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <h1 className="text-style-h1 text-text">{t("hero.title")}</h1>
        <p className="mt-(--spacing-element-gap) text-style-lead text-text-secondary">
          {t("hero.subtitle")}
        </p>
      </section>

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <h2 className="text-style-h2 text-text">{t("openPositions")}</h2>
        <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
          {t("noOpenPositions")}
        </p>
      </section>

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="mx-auto max-w-160 desktop:text-center">
          <p className="text-style-body text-text-secondary">
            <Trans
              t={t}
              i18nKey="links.text"
              components={{
                about: <PressableText href="/about" />,
                contact: <PressableText href="/contact" />,
              }}
            />
          </p>
        </div>
      </section>
    </main>
  );
}
