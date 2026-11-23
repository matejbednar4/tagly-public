import type { Metadata } from "next";
import { CreditCard, Coins, Globe, Eye, Users } from "lucide-react";
import { Trans } from "react-i18next/TransWithoutContext";
import { PressableText } from "@/components/ui/PressableText";
import { CtaSection } from "@/components/sections/CtaSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "pricing");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/pricing"),
    openGraph: { title, description },
  };
}

// Two funding routes, and only two. Pay as you go first: it is the route with no
// barrier to entry (an active card is its own visibility branch, so a business
// with a linked card and zero credits is live). Staying visible is NOT a third
// route — it is the rule that governs both, so it renders below the pair.
const fundingIcons = [CreditCard, Coins];
// Two price factors, and only two: where the audience is, and how many people
// really saw the story. That pair IS the pitch. Everything else that feeds the
// price is an internal lever and is deliberately not published — do not add a
// third card describing one. Keep in sync with pricing.{en,cs}.json.
const factorIcons = [Globe, Eye];

// Index of "Are credits refundable?" in faq.items — the one answer rendered
// with an inline link to /support. Keep in sync with pricing.{en,cs}.json.
const REFUND_FAQ_INDEX = 3;

export default async function PricingPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, ["pricing", "common"]);

  const fundingRoutes = t("funding.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const factors = t("factors.items", { returnObjects: true }) as Array<{
    label: string;
    title: string;
    description: string;
  }>;
  const costExamples = t("examples.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const faqItems = t("faq.items", { returnObjects: true }) as Array<{
    question: string;
    answer: string;
  }>;
  const exampleIcons = [Users, Eye];

  return (
    <main>
      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pt-(--spacing-section-gap) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="mx-auto max-w-160">
          <h1 className="text-style-h1 text-text desktop:text-center">
            {t("hero.title")}
          </h1>
          <p className="mt-(--spacing-element-gap) text-style-lead text-text-secondary desktop:text-center">
            {t("hero.intro")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("funding.title")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary desktop:text-center">
          {t("funding.intro")}
        </p>

        <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-2">
          {fundingRoutes.map((card, index) => {
            const Icon = fundingIcons[index];
            return (
              <article
                key={index}
                className="card p-(--spacing-element-gap) mt-(--spacing-element-gap) first:mt-0 sm:nth-[-n+2]:mt-0 sm:mr-(--spacing-card-padding) sm:last:mr-0"
              >
                <Icon className="h-8 w-8 text-ink" strokeWidth={1.5} />
                <h3 className="mt-(--spacing-card-padding) text-style-h3 text-text">
                  {card.title}
                </h3>
                <p className="mt-(--spacing-card-padding) text-style-body text-text-secondary">
                  {card.description}
                </p>
              </article>
            );
          })}
        </div>

        {/* Staying visible governs both routes, so it sits under the pair
            rather than beside them as a third option. */}
        <div className="mt-(--spacing-block-gap) mx-auto max-w-160">
          <h3 className="text-style-h3 text-text desktop:text-center">
            {t("funding.visibility.title")}
          </h3>
          <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary desktop:text-center">
            {t("funding.visibility.description")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("factors.title")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary desktop:text-center">
          {t("factors.intro")}
        </p>

        <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-element-gap)">
          {factors.map((factor, index) => {
            const Icon = factorIcons[index];
            return (
              <article
                key={index}
                className="card p-(--spacing-element-gap)"
              >
                <Icon className="h-6 w-6 text-ink" strokeWidth={1.5} />
                <span className="mt-(--spacing-tight-gap) block text-style-small-body-bold uppercase tracking-wide text-text-secondary">
                  {factor.label}
                </span>
                <h3 className="mt-(--spacing-tight-gap) text-style-h3 text-text">
                  {factor.title}
                </h3>
                <p className="mt-(--spacing-card-padding) text-style-body text-text-secondary">
                  {factor.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="pb-(--spacing-section-gap) desktop:mx-auto desktop:max-w-page-max-width desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="bg-ink p-(--spacing-element-gap) overflow-hidden desktop:rounded-lg desktop:p-(--spacing-block-gap)">
          <div className="mx-auto max-w-160">
            <h2 className="text-style-h2 text-on-ink desktop:text-center">
              {t("examples.title")}
            </h2>
            <p className="mt-(--spacing-element-gap) text-style-body text-on-ink/80 desktop:text-center">
              {t("examples.intro")}
            </p>
          </div>

          <div className="mt-(--spacing-block-gap) grid grid-cols-1 gap-(--spacing-element-gap) sm:grid-cols-2">
            {costExamples.map((example, index) => {
              const Icon = exampleIcons[index];
              return (
                <article
                  key={index}
                  className="rounded-lg bg-surface p-(--spacing-element-gap)"
                >
                  <Icon className="text-ink" size={36} aria-hidden="true" />
                  <h3 className="mt-(--spacing-card-padding) text-style-h3 text-text">
                    {example.title}
                  </h3>
                  <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
                    {example.description}
                  </p>
                </article>
              );
            })}
          </div>

          <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-on-ink/80 desktop:text-center">
            {t("examples.footnote")}
          </p>
        </div>
      </section>

      <FaqSection
        heading={t("faq.heading")}
        items={faqItems.map((item, index) => ({
          question: item.question,
          answer: item.answer,
          // Only the refund answer carries an inline link; the rest are plain
          // text, and `answer` is what feeds the FAQPage JSON-LD either way.
          answerContent:
            index === REFUND_FAQ_INDEX ? (
              <Trans
                t={t}
                i18nKey="faq.refundInline"
                components={{ link: <PressableText href="/support" /> }}
              />
            ) : undefined,
        }))}
      />

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="card p-(--spacing-element-gap) desktop:p-(--spacing-block-gap)">
          <h2 className="text-style-h2 text-text desktop:text-center">
            {t("compare.title")}
          </h2>
          <p className="mt-(--spacing-element-gap) mx-auto max-w-160 desktop:text-center text-style-body text-text-secondary">
            {t("compare.intro")}
          </p>

          <div className="mt-(--spacing-element-gap) flex flex-col gap-(--spacing-card-padding) desktop:flex-row desktop:flex-wrap desktop:items-center desktop:justify-center desktop:gap-0">
            {[
              { label: t("compare.instagramAds"), href: "/instagram-ads-vs-tagly" },
              { label: t("compare.influencerMarketing"), href: "/influencer-marketing-vs-tagly" },
              { label: t("compare.marketingAgencies"), href: "/marketing-agencies-vs-tagly" },
            ].map((link, i) => (
              <span key={link.href}>
                <PressableText href={link.href}>{link.label}</PressableText>
                {i < 2 && (
                  <span className="mx-(--spacing-card-padding) text-text-tertiary hidden desktop:inline">
                    ·
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        heading={t("cta.heading")}
        description={t("cta.description")}
        primaryAction={{ label: t("common:getInTouch"), href: "/#contact" }}
        secondaryAction={{ label: t("cta.readFaq"), href: "/faq" }}
      />
    </main>
  );
}
