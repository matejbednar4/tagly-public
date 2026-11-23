import type { Metadata } from "next";
import { ContactRequestForm } from "@/components/contact/ContactRequestForm";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

// This page also serves as the support page: the old standalone /support was
// merged into it 2026-08-09, and /support 301s here (the App Store / Meta
// support links keep resolving through that redirect). The page is just hero +
// the dynamic form — the form's category picks the delivery inbox (see
// src/lib/contact-inboxes.ts).

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "contact");

  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: buildAlternates(lng, "/contact"),
    openGraph: { title: t("meta.ogTitle"), description: t("meta.description"), images: ["/og-image.png"] },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "contact");

  return (
    <main>
      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pt-(--spacing-section-gap) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="mx-auto max-w-160">
          <h1 className="text-style-h1 text-text">{t("hero.title")}</h1>
          <p className="mt-(--spacing-element-gap) text-style-lead text-text-secondary">
            {t("hero.subtitle")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="mx-auto max-w-160">
          <ContactRequestForm />
        </div>
      </section>
    </main>
  );
}
