import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Trans } from "react-i18next/TransWithoutContext";
import { FaqJsonLd, FaqSection } from "@/components/sections/FaqSection";
import { CtaSection } from "@/components/sections/CtaSection";
import { PressableText } from "@/components/ui/PressableText";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";
import { CUSTOMER_APP_URL } from "@/lib/links";
import type { TFunction } from "i18next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "for-customers-faq");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/for-customers/faq"),
    openGraph: { title, description },
  };
}

type FaqItem = { question: string; answer: string; answerContent?: ReactNode };

function withInline(
  items: FaqItem[],
  overrides: Record<number, ReactNode>,
): FaqItem[] {
  return items.map((item, i) =>
    overrides[i] ? { ...item, answerContent: overrides[i] } : item,
  );
}

const taglyAppHref = CUSTOMER_APP_URL;

export default async function ForCustomersFAQPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "for-customers-faq");
  const tf = t as TFunction;

  const gettingStarted = t("gettingStarted.items", { returnObjects: true }) as FaqItem[];
  const posting = t("posting.items", { returnObjects: true }) as FaqItem[];
  const rewards = t("rewards.items", { returnObjects: true }) as FaqItem[];
  const account = t("account.items", { returnObjects: true }) as FaqItem[];

  const gettingStartedItems = withInline(gettingStarted, {
    2: <Trans t={tf} i18nKey="gettingStarted.q3Inline" components={{ hiw: <PressableText href="/for-customers/how-it-works" /> }} />,
    5: <Trans t={tf} i18nKey="gettingStarted.q6Inline" components={{ app: <PressableText href={taglyAppHref} /> }} />,
  });
  const postingItems = withInline(posting, {
    0: <Trans t={tf} i18nKey="posting.q1Inline" components={{ hiw: <PressableText href="/for-customers/how-it-works" /> }} />,
  });
  const accountItems = withInline(account, {
    1: <Trans t={tf} i18nKey="account.q2Inline" components={{ dataDeletion: <PressableText href="/instagram-data-deletion" /> }} />,
  });

  return (
    <main>
      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pt-(--spacing-section-gap) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="mx-auto max-w-160">
          <h1 className="text-style-h1 text-text desktop:text-center">
            {t("hero.title")}
          </h1>
          <p className="mt-(--spacing-element-gap) text-style-lead text-text-secondary desktop:text-center">
            <Trans
              t={tf}
              i18nKey="hero.intro"
              components={{ support: <PressableText href="/support" /> }}
            />
          </p>
        </div>
      </section>

      {/* One FAQPage entity for the whole URL. Each section renders its own
          markup with renderJsonLd={false} so the page does not ship four
          competing FAQPage entities. */}
      <FaqJsonLd
        items={[
          ...gettingStartedItems,
          ...postingItems,
          ...rewards,
          ...accountItems,
        ]}
      />
      <FaqSection
        heading={t("groups.gettingStarted")}
        items={gettingStartedItems}
        renderJsonLd={false}
      />
      <FaqSection
        heading={t("groups.posting")}
        items={postingItems}
        renderJsonLd={false}
      />
      <FaqSection
        heading={t("groups.rewards")}
        items={rewards}
        renderJsonLd={false}
      />
      <FaqSection
        heading={t("groups.account")}
        items={accountItems}
        renderJsonLd={false}
      />

      <CtaSection
        heading={t("cta.heading")}
        description={t("cta.description")}
        primaryAction={{ label: t("cta.download"), href: taglyAppHref }}
        secondaryAction={{ label: t("cta.seeHowItWorks"), href: "/for-customers/how-it-works" }}
      />
    </main>
  );
}
