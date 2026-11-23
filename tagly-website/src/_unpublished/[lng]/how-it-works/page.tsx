import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { PressableText } from "@/components/ui/PressableText";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { CtaSection } from "@/components/sections/CtaSection";
import { Users, Camera } from "lucide-react";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "how-it-works");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/how-it-works"),
    openGraph: { title, description },
  };
}

// The five images are the advertiser app's onboarding carousel
// (tagly-advertiser assets/how-it-works), copied verbatim per locale — the
// same source the landing page's step cards use.
//
// The carousel's order is NOT this page's order, so the files are remapped to
// the step each one actually illustrates. Verified by opening every file:
//   step-1 business page · step-2 IG Story composer · step-3 share detail with
//   the paid amount · step-4 share detail with the performance card ·
//   step-5 Home, showing available credits and the pay-as-you-go card slot.
// Hence: s1 page → 1, s2 funding → 5, s3 customer shares → 2, s4 price → 3,
// s5 rate and review → 4. Changing a step's copy means rechecking this map.
const STEP_IMAGE_ORDER = [1, 5, 2, 3, 4];

const stepImages = (lng: string) =>
  STEP_IMAGE_ORDER.map(
    (n) =>
      `/images/how-it-works/advertisers/${lng === "cs" ? "cs" : "en"}/step-${n}.webp`,
  );

type Step = {
  number: number;
  image: string;
  alt: string;
  title: string;
  description: ReactNode;
  cta?: { label: string; href: string };
};

function StepSection({ step, index }: { step: Step; index: number }) {
  const reversed = index % 2 === 1;
  return (
    <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
      <div
        className={`flex flex-col desktop:flex-row desktop:items-center ${
          reversed ? "desktop:flex-row-reverse" : ""
        }`}
      >
        <div
          className={`desktop:w-1/2 ${
            reversed
              ? "desktop:pl-(--spacing-block-gap)"
              : "desktop:pr-(--spacing-block-gap)"
          }`}
        >
          <div className="mx-auto w-full max-w-64 desktop:max-w-80">
            <div className="relative aspect-1097/1839 overflow-hidden rounded-lg">
              <ImageLightbox
                src={step.image}
                alt={step.alt}
                fill
                className="object-contain"
                sizes="(max-width: 1200px) 256px, 320px"
              />
            </div>
          </div>
        </div>
        <div
          className={`mt-(--spacing-element-gap) desktop:mt-0 desktop:w-1/2 ${
            reversed
              ? "desktop:pr-(--spacing-block-gap)"
              : "desktop:pl-(--spacing-block-gap)"
          }`}
        >
          <h2
            className={`text-style-h2 text-text ${reversed ? "desktop:text-right" : ""}`}
          >
            {step.number}. {step.title}
          </h2>
          <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary text-justify">
            {step.description}
          </p>
          {step.cta && (
            <div
              className={`mt-(--spacing-element-gap) ${reversed ? "desktop:text-right" : ""}`}
            >
              <Button
                type="secondary"
                size="small"
                label={step.cta.label}
                href={step.cta.href}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, ["how-it-works", "common"]);

  const whyCards = t("why.cards", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const whyIcons = [Users, Camera];

  const images = stepImages(lng);

  const topSteps: Step[] = [
    {
      number: 1,
      image: images[0],
      alt: t("steps.s1.alt"),
      title: t("steps.s1.title"),
      description: t("steps.s1.desc"),
    },
    {
      number: 2,
      image: images[1],
      alt: t("steps.s2.alt"),
      title: t("steps.s2.title"),
      description: t("steps.s2.desc"),
      cta: { label: t("common:seePricing"), href: "/pricing" },
    },
    {
      number: 3,
      image: images[2],
      alt: t("steps.s3.alt"),
      title: t("steps.s3.title"),
      description: t("steps.s3.desc"),
    },
  ];

  const bottomSteps: Step[] = [
    {
      number: 4,
      image: images[3],
      alt: t("steps.s4.alt"),
      title: t("steps.s4.title"),
      description: t("steps.s4.desc"),
      cta: { label: t("steps.s4.cta"), href: "/pricing" },
    },
    {
      number: 5,
      image: images[4],
      alt: t("steps.s5.alt"),
      title: t("steps.s5.title"),
      description: t("steps.s5.desc"),
    },
  ];

  const industries = [
    { label: t("industry.links.restaurants"), href: "/restaurants" },
    { label: t("industry.links.cafes"), href: "/cafes" },
    { label: t("industry.links.gyms"), href: "/gyms" },
    { label: t("industry.links.salons"), href: "/salons" },
    { label: t("industry.links.other"), href: "/local-businesses" },
  ];

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

      {topSteps.map((step) => (
        <StepSection key={step.number} step={step} index={step.number - 1} />
      ))}

      <section className="pb-(--spacing-section-gap) desktop:mx-auto desktop:max-w-page-max-width desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="bg-ink p-(--spacing-element-gap) overflow-hidden desktop:rounded-lg desktop:p-(--spacing-block-gap)">
          <div className="mx-auto max-w-160">
            <h2 className="text-style-h2 text-on-ink desktop:text-center">
              {t("why.title")}
            </h2>
            <p className="mt-(--spacing-element-gap) text-style-body text-on-ink/80 desktop:text-center">
              {t("why.intro")}
            </p>
          </div>

          <div className="mt-(--spacing-block-gap) grid grid-cols-1 gap-(--spacing-element-gap) sm:grid-cols-2">
            {whyCards.map((card, index) => {
              const Icon = whyIcons[index];
              return (
                <article
                  key={index}
                  className="rounded-lg bg-surface p-(--spacing-element-gap)"
                >
                  <Icon className="text-ink" size={36} aria-hidden="true" />
                  <h3 className="mt-(--spacing-card-padding) text-style-h3 text-text">
                    {card.title}
                  </h3>
                  <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
                    {card.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {bottomSteps.map((step) => (
        <StepSection key={step.number} step={step} index={step.number - 1} />
      ))}

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="card p-(--spacing-element-gap) desktop:p-(--spacing-block-gap)">
          <h2 className="text-style-h2 text-text desktop:text-center">
            {t("industry.title")}
          </h2>
          <p className="mt-(--spacing-element-gap) mx-auto max-w-160 desktop:text-center text-style-body text-text-secondary">
            {t("industry.intro")}
          </p>

          <div className="mt-(--spacing-element-gap) flex flex-col gap-(--spacing-card-padding) desktop:flex-row desktop:flex-wrap desktop:items-center desktop:justify-center desktop:gap-0">
            {industries.map((industry, i) => (
              <span key={industry.href}>
                <PressableText href={industry.href}>
                  {industry.label}
                </PressableText>
                {i < industries.length - 1 && (
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
