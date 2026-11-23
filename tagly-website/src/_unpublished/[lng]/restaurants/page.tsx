import type { Metadata } from "next";
import {
  Target,
  Users,
  Briefcase,
  UtensilsCrossed,
  MapPin,
  MessageCircle,
  HandCoins,
  Rocket,
  CalendarCheck,
  Trophy,
} from "lucide-react";
import { Trans } from "react-i18next/TransWithoutContext";
import { Button } from "@/components/ui/Button";
import { PressableText } from "@/components/ui/PressableText";
import { CtaSection } from "@/components/sections/CtaSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "restaurants");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/restaurants"),
    openGraph: { title, description },
  };
}

const sectionClass =
  "mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)";

function FlowchartArrow() {
  return (
    <div className="flex items-center justify-center py-(--spacing-card-padding)">
      <svg
        width="24"
        height="32"
        viewBox="0 0 24 32"
        fill="none"
        className="text-ink"
      >
        <path
          d="M12 0 L12 24 M6 18 L12 26 L18 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function FlowchartArrowHorizontal() {
  return (
    <div className="hidden desktop:flex items-center justify-center px-(--spacing-card-padding)">
      <svg
        width="32"
        height="24"
        viewBox="0 0 32 24"
        fill="none"
        className="text-ink"
      >
        <path
          d="M0 12 L24 12 M18 6 L26 12 L18 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function FlowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex-1 card p-(--spacing-element-gap)">
      <div className="mb-(--spacing-card-padding) flex h-10 w-10 items-center justify-center rounded-max bg-brand text-style-body-bold text-on-brand">
        {number}
      </div>
      <h3 className="text-style-h3 text-text">{title}</h3>
      <p className="mt-(--spacing-card-padding) text-style-body text-text-secondary">
        {description}
      </p>
    </div>
  );
}

const brokenIcons = [Target, Users, Briefcase];
const brokenLinks = [
  "/instagram-ads-vs-tagly",
  "/influencer-marketing-vs-tagly",
  "/marketing-agencies-vs-tagly",
];
const examplePhotos = [
  "/images/share-examples/restaurants/1.png",
  "/images/share-examples/restaurants/2.png",
  "/images/share-examples/restaurants/3.png",
  "/images/share-examples/restaurants/4.png",
  "/images/share-examples/restaurants/5.png",
  "/images/share-examples/restaurants/6.png",
];
const whyIcons = [UtensilsCrossed, MapPin, MessageCircle, HandCoins];
const useCaseIcons = [Rocket, CalendarCheck, Trophy];

export default async function RestaurantsPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, ["restaurants", "common"]);

  const brokenItems = t("broken.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
    link: string;
  }>;
  const howSteps = t("how.steps", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const exampleAlts = t("examples.alts", { returnObjects: true }) as string[];
  const whyItems = t("whyRestaurants.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const useCases = t("useCases.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const faqItems = t("faq.items", { returnObjects: true }) as Array<{
    question: string;
    answer: string;
  }>;

  return (
    <main>
      {/* Hero */}
      <section className={`${sectionClass} pt-(--spacing-section-gap)`}>
        <div className="mx-auto max-w-200">
          <h1 className="text-style-h1 text-text desktop:text-center">
            {t("hero.title")}
          </h1>
          <p className="mt-(--spacing-element-gap) text-style-lead text-text-secondary desktop:text-center">
            {t("hero.intro")}
          </p>
          <div className="mt-(--spacing-block-gap) flex flex-row items-center desktop:justify-center">
            <Button
              type="primary"
              size="large"
              label={t("common:getInTouch")}
              href="/#contact"
            />
            <div className="ml-(--spacing-card-padding)">
              <Button
                type="secondary"
                size="large"
                label={t("common:seeHowItWorks")}
                href="/how-it-works"
              />
            </div>
          </div>
        </div>
      </section>

      {/* The problem with restaurant marketing */}
      <section className={sectionClass}>
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("broken.title")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary desktop:text-center">
          {t("broken.intro")}
        </p>

        <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-3">
          {brokenItems.map((item, index) => {
            const Icon = brokenIcons[index];
            return (
              <article
                key={index}
                className={`card p-(--spacing-element-gap) ${
                  index > 0 ? "mt-(--spacing-element-gap) sm:mt-0" : ""
                } ${index < 2 ? "sm:mr-(--spacing-card-padding)" : ""}`}
              >
                <Icon className="text-ink" size={36} aria-hidden="true" />
                <h3 className="mt-(--spacing-card-padding) text-style-h3 text-text">
                  {item.title}
                </h3>
                <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
                  {item.description}
                </p>
                <p className="mt-(--spacing-card-padding) text-style-body">
                  <PressableText href={brokenLinks[index]}>
                    {item.link}
                  </PressableText>
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* How Tagly works for restaurants */}
      <section className={sectionClass}>
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("how.title")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary desktop:text-center">
          {t("how.intro")}
        </p>

        {/* Mobile: vertical flow */}
        <div className="mt-(--spacing-block-gap) flex flex-col desktop:hidden">
          {howSteps.map((step, index) => (
            <div key={index} className="contents">
              <FlowStep
                number={String(index + 1)}
                title={step.title}
                description={step.description}
              />
              {index < howSteps.length - 1 && <FlowchartArrow />}
            </div>
          ))}
        </div>

        {/* Desktop: horizontal flow */}
        <div className="mt-(--spacing-block-gap) hidden desktop:flex desktop:items-stretch">
          {howSteps.map((step, index) => (
            <div key={index} className="contents">
              <FlowStep
                number={String(index + 1)}
                title={step.title}
                description={step.description}
              />
              {index < howSteps.length - 1 && <FlowchartArrowHorizontal />}
            </div>
          ))}
        </div>

        <div className="mt-(--spacing-block-gap) desktop:text-center">
          <Button
            type="secondary"
            size="small"
            label={t("how.fullGuide")}
            href="/how-it-works"
          />
        </div>
      </section>

      {/* Example customer posts */}
      <section className={sectionClass}>
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("examples.title")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary desktop:text-center">
          {t("examples.intro")}
        </p>

        <div className="mt-(--spacing-block-gap) grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" style={{ gap: "var(--spacing-card-padding)" }}>
          {examplePhotos.map((src, index) => (
            <div
              key={src}
              className="relative aspect-9/16 overflow-hidden card"
            >
              <ImageLightbox
                src={src}
                alt={exampleAlts[index]}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Why Tagly works especially well for restaurants */}
      <section className="pb-(--spacing-section-gap) desktop:mx-auto desktop:max-w-page-max-width desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="bg-ink p-(--spacing-element-gap) overflow-hidden desktop:rounded-lg desktop:p-(--spacing-block-gap)">
          <div className="mx-auto max-w-160">
            <h2 className="text-style-h2 text-on-ink desktop:text-center">
              {t("whyRestaurants.title")}
            </h2>
            <p className="mt-(--spacing-element-gap) text-style-body text-on-ink/80 desktop:text-center">
              {t("whyRestaurants.intro")}
            </p>
          </div>

          <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-2">
            {whyItems.map((benefit, index) => {
              const Icon = whyIcons[index];
              return (
                <article
                  key={index}
                  className={`rounded-lg bg-surface p-(--spacing-element-gap) ${
                    index % 2 === 0
                      ? "sm:mr-(--spacing-card-padding)"
                      : "sm:ml-(--spacing-card-padding)"
                  } ${index >= 2 ? "mt-(--spacing-element-gap)" : index === 1 ? "mt-(--spacing-element-gap) sm:mt-0" : ""}`}
                >
                  <Icon className="text-ink" size={36} aria-hidden="true" />
                  <h3 className="mt-(--spacing-card-padding) text-style-h3 text-text">
                    {benefit.title}
                  </h3>
                  <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
                    {benefit.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className={sectionClass}>
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("useCases.title")}
        </h2>

        <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-3">
          {useCases.map((useCase, index) => {
            const Icon = useCaseIcons[index];
            return (
              <article
                key={index}
                className={`card p-(--spacing-element-gap) ${
                  index > 0 ? "mt-(--spacing-element-gap) sm:mt-0" : ""
                } ${index < 2 ? "sm:mr-(--spacing-card-padding)" : ""}`}
              >
                <Icon className="text-ink" size={36} aria-hidden="true" />
                <h3 className="mt-(--spacing-card-padding) text-style-h3 text-text">
                  {useCase.title}
                </h3>
                <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
                  {useCase.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <FaqSection
        heading={t("faq.heading")}
        items={[
          {
            question: faqItems[0].question,
            answer: faqItems[0].answer,
            answerContent: (
              <Trans
                t={t}
                i18nKey="faq.costInline"
                components={{ link: <PressableText href="/pricing" /> }}
              />
            ),
          },
          {
            question: faqItems[1].question,
            answer: faqItems[1].answer,
          },
          {
            question: faqItems[2].question,
            answer: faqItems[2].answer,
            answerContent: (
              <Trans
                t={t}
                i18nKey="faq.influencerInline"
                components={{
                  link: <PressableText href="/influencer-marketing-vs-tagly" />,
                }}
              />
            ),
          },
          {
            question: faqItems[3].question,
            answer: faqItems[3].answer,
          },
          {
            question: faqItems[4].question,
            answer: faqItems[4].answer,
          },
          {
            question: faqItems[5].question,
            answer: faqItems[5].answer,
          },
        ]}
      />

      {/* Internal links */}
      <section className={sectionClass}>
        <div className="card p-(--spacing-element-gap) desktop:p-(--spacing-block-gap)">
          <div className="grid grid-cols-1 sm:grid-cols-2 desktop:text-center">
            <div className="sm:pr-(--spacing-element-gap)">
              <h3 className="text-style-h3 text-text">
                {t("internalLinks.compareHeading")}
              </h3>
              <div className="mt-(--spacing-tight-gap) flex flex-col gap-(--spacing-card-padding) text-style-body desktop:flex-row desktop:items-center desktop:justify-center desktop:gap-0">
                <PressableText href="/instagram-ads-vs-tagly">
                  {t("internalLinks.instagramAds")}
                </PressableText>
                <span className="mx-(--spacing-card-padding) text-text-tertiary hidden desktop:inline"> · </span>
                <PressableText href="/influencer-marketing-vs-tagly">
                  {t("internalLinks.influencerMarketing")}
                </PressableText>
                <span className="mx-(--spacing-card-padding) text-text-tertiary hidden desktop:inline"> · </span>
                <PressableText href="/marketing-agencies-vs-tagly">
                  {t("internalLinks.marketingAgencies")}
                </PressableText>
              </div>
            </div>
            <div className="mt-(--spacing-element-gap) sm:mt-0 sm:pl-(--spacing-element-gap)">
              <h3 className="text-style-h3 text-text">
                {t("internalLinks.learnMoreHeading")}
              </h3>
              <div className="mt-(--spacing-tight-gap) flex flex-col gap-(--spacing-card-padding) text-style-body desktop:flex-row desktop:items-center desktop:justify-center desktop:gap-0">
                <PressableText href="/how-it-works">
                  {t("internalLinks.howItWorks")}
                </PressableText>
                <span className="mx-(--spacing-card-padding) text-text-tertiary hidden desktop:inline"> · </span>
                <PressableText href="/pricing">
                  {t("internalLinks.pricing")}
                </PressableText>
                <span className="mx-(--spacing-card-padding) text-text-tertiary hidden desktop:inline"> · </span>
                <PressableText href="/faq">
                  {t("internalLinks.faq")}
                </PressableText>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaSection
        heading={t("cta.heading")}
        description={t("cta.description")}
        primaryAction={{ label: t("common:getInTouch"), href: "/#contact" }}
        secondaryAction={{ label: t("common:seePricing"), href: "/pricing" }}
      />
    </main>
  );
}
