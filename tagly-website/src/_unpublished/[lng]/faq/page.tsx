import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Trans } from "react-i18next/TransWithoutContext";
import { FaqJsonLd, FaqSection } from "@/components/sections/FaqSection";
import { CtaSection } from "@/components/sections/CtaSection";
import { PressableText } from "@/components/ui/PressableText";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";
import { BUSINESS_APP_URL } from "@/lib/links";
import type { TFunction } from "i18next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "faq");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/faq"),
    openGraph: { title, description },
  };
}

type FaqItem = { question: string; answer: string; answerContent?: ReactNode };

// Returns a copy of a group's items with answerContent (a <Trans> node) set on
// the items identified by their index.
function withInline(
  items: FaqItem[],
  overrides: Record<number, ReactNode>,
): FaqItem[] {
  return items.map((item, i) =>
    overrides[i] ? { ...item, answerContent: overrides[i] } : item,
  );
}

const appHref = BUSINESS_APP_URL;

const industryComponents = {
  restaurants: <PressableText href="/restaurants" />,
  cafes: <PressableText href="/cafes" />,
  gyms: <PressableText href="/gyms" />,
  salons: <PressableText href="/salons" />,
  local: <PressableText href="/local-businesses" />,
};

export default async function FAQPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, ["faq", "common"]);
  // getFixedT is bound to the "faq" namespace; pass it to <Trans>.
  const tf = t as TFunction;

  const general = t("general.items", { returnObjects: true }) as FaqItem[];
  const gettingStarted = t("gettingStarted.items", { returnObjects: true }) as FaqItem[];
  const pricing = t("pricing.items", { returnObjects: true }) as FaqItem[];
  const howItWorks = t("howItWorks.items", { returnObjects: true }) as FaqItem[];
  const results = t("results.items", { returnObjects: true }) as FaqItem[];

  const generalItems = withInline(general, {
    0: <Trans t={tf} i18nKey="general.q1Inline" components={{ hiw: <PressableText href="/how-it-works" /> }} />,
    1: <Trans t={tf} i18nKey="general.q2Inline" components={industryComponents} />,
    2: <Trans t={tf} i18nKey="general.q3Inline" components={{ compare: <PressableText href="/influencer-marketing-vs-tagly" /> }} />,
    4: <Trans t={tf} i18nKey="general.q5Inline" components={industryComponents} />,
  });

  const gettingStartedItems = withInline(gettingStarted, {
    0: <Trans t={tf} i18nKey="gettingStarted.q1Inline" components={{ app: <PressableText href={appHref} /> }} />,
    1: <Trans t={tf} i18nKey="gettingStarted.q2Inline" components={{ pricing: <PressableText href="/pricing" /> }} />,
    5: <Trans t={tf} i18nKey="gettingStarted.q6Inline" components={{ app: <PressableText href={appHref} />, referrals: <PressableText href="/referrals" /> }} />,
  });

  const pricingItems = withInline(pricing, {
    0: <Trans t={tf} i18nKey="pricing.q1Inline" components={{ pricing: <PressableText href="/pricing" /> }} />,
    5: <Trans t={tf} i18nKey="pricing.q6Inline" components={{ support: <PressableText href="/support" /> }} />,
  });

  const resultsItems = withInline(results, {
    3: <Trans t={tf} i18nKey="results.q4Inline" components={{ iads: <PressableText href="/instagram-ads-vs-tagly" />, influencer: <PressableText href="/influencer-marketing-vs-tagly" />, agencies: <PressableText href="/marketing-agencies-vs-tagly" /> }} />,
  });

  // Exactly one FAQPage entity per URL: the five sections below opt out of
  // emitting their own JSON-LD and every question is published here instead.
  const allItems = [
    ...generalItems,
    ...gettingStartedItems,
    ...pricingItems,
    ...howItWorks,
    ...resultsItems,
  ];

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
              components={{ contact: <PressableText href="/#contact" /> }}
            />
          </p>
        </div>
      </section>

      <FaqJsonLd items={allItems} />

      <FaqSection heading={t("groups.general")} items={generalItems} renderJsonLd={false} />
      <FaqSection heading={t("groups.gettingStarted")} items={gettingStartedItems} renderJsonLd={false} />
      <FaqSection heading={t("groups.pricing")} items={pricingItems} renderJsonLd={false} />
      <div className="mx-auto max-w-200 px-(--spacing-page-horizontal-padding) desktop:px-(--spacing-page-horizontal-padding-lg) -mt-(--spacing-block-gap) pb-(--spacing-section-gap) desktop:text-center">
        <PressableText href="/pricing">{t("links.seePricing")}</PressableText>
      </div>

      <FaqSection heading={t("groups.howItWorks")} items={howItWorks} renderJsonLd={false} />
      <div className="mx-auto max-w-200 px-(--spacing-page-horizontal-padding) desktop:px-(--spacing-page-horizontal-padding-lg) -mt-(--spacing-block-gap) pb-(--spacing-section-gap) desktop:text-center">
        <PressableText href="/how-it-works">
          {t("links.learnMoreHowItWorks")}
        </PressableText>
      </div>
      <FaqSection heading={t("groups.results")} items={resultsItems} renderJsonLd={false} />

      <CtaSection
        heading={t("cta.heading")}
        description={t("cta.description")}
        primaryAction={{ label: t("common:getInTouch"), href: "/#contact" }}
        secondaryAction={{ label: t("common:seePricing"), href: "/pricing" }}
      />
    </main>
  );
}
