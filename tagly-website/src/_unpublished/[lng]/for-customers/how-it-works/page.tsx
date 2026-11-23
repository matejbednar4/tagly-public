import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { Clock } from "lucide-react";
import { Trans } from "react-i18next/TransWithoutContext";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { CtaSection } from "@/components/sections/CtaSection";
import { PressableText } from "@/components/ui/PressableText";
import { ScrollLink } from "@/components/ui/ScrollLink";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";
import { CUSTOMER_APP_URL } from "@/lib/links";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "for-customers-how-it-works");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/for-customers/how-it-works"),
    openGraph: { title, description },
  };
}

const taglyAppHref = CUSTOMER_APP_URL;

// Artwork is the customer app's onboarding carousel (tagly-customer
// assets/how-it-works), copied verbatim per locale. The app's slide order is
// find-a-place → compose the story → reward paid → insights, which does not
// match this page's step order, so each step names its slide explicitly.
// Step 3 ("wait for verification") has no matching screen and keeps its clock
// tile; the app's insights slide (4) is unused here.
const customerSlide = (lng: string, slide: number) =>
  `/images/how-it-works/customers/${lng === "cs" ? "cs" : "en"}/step-${slide}.webp`;

const examplePhotos = [
  "/images/share-examples/cafes/1.png",
  "/images/share-examples/cafes/3.png",
  "/images/share-examples/cafes/6.png",
  "/images/share-examples/restaurants/4.png",
  "/images/share-examples/gyms/2.png",
  "/images/share-examples/restaurants/2.png",
];

export default async function ForCustomersHowItWorksPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "for-customers-how-it-works");
  const exampleAlts = t("examples.alts", { returnObjects: true }) as string[];

  type Step = {
    number: number;
    image?: string;
    alt?: string;
    title: string;
    description: ReactNode;
  };

  const steps: Step[] = [
    {
      number: 1,
      image: customerSlide(lng, 2), // composing the Instagram story
      alt: t("steps.s1.alt"),
      title: t("steps.s1.title"),
      description: (
        <Trans
          t={t}
          i18nKey="steps.s1.desc"
          components={{ examples: <ScrollLink targetId="examples" /> }}
        />
      ),
    },
    {
      number: 2,
      image: customerSlide(lng, 1), // the Tagly app's map, "Earn here"
      alt: t("steps.s2.alt"),
      title: t("steps.s2.title"),
      description: (
        <Trans
          t={t}
          i18nKey="steps.s2.desc"
          components={{ app: <PressableText href={taglyAppHref} /> }}
        />
      ),
    },
    {
      number: 3,
      title: t("steps.s3.title"),
      description: t("steps.s3.desc"),
    },
    {
      number: 4,
      image: customerSlide(lng, 3), // reward earned, paid out
      alt: t("steps.s4.alt"),
      title: t("steps.s4.title"),
      description: (
        <Trans
          t={t}
          i18nKey="steps.s4.desc"
          components={{ app: <PressableText href={taglyAppHref} /> }}
        />
      ),
    },
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

      {steps.map((step, index) => (
        <section
          key={step.number}
          className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)"
        >
          <div
            className={`flex flex-col desktop:flex-row desktop:items-center desktop:justify-center ${
              index % 2 === 1 ? "desktop:flex-row-reverse" : ""
            }`}
          >
            <div className="desktop:hidden">
              <h2 className="text-style-h2 text-text">
                {step.number}. {step.title}
              </h2>
            </div>
            <div className="mt-(--spacing-element-gap) desktop:mt-0 w-48 max-w-full desktop:w-full desktop:max-w-72">
              {step.image ? (
                <div className="relative aspect-1097/1839 overflow-hidden rounded-lg">
                  <Image
                    src={step.image}
                    alt={step.alt ?? ""}
                    fill
                    className="object-contain"
                    sizes="(max-width: 1200px) 192px, 288px"
                  />
                </div>
              ) : (
                <div className="flex aspect-1097/1839 flex-col items-center justify-center card">
                  <Clock size={64} className="text-ink" aria-hidden="true" />
                  <p className="mt-(--spacing-card-padding) text-style-h1 text-text">24h</p>
                </div>
              )}
            </div>
            <div
              className={`mt-(--spacing-tight-gap) desktop:mt-0 max-w-lg ${
                index % 2 === 1
                  ? "desktop:mr-(--spacing-block-gap)"
                  : "desktop:ml-(--spacing-block-gap)"
              }`}
            >
              <h2 className="hidden desktop:block text-style-h2 text-text">
                {step.number}. {step.title}
              </h2>
              <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary desktop:text-justify">
                {step.description}
              </p>
            </div>
          </div>
        </section>
      ))}

      <section
        id="examples"
        className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)"
      >
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("examples.title")}
        </h2>
        <div className="mt-(--spacing-block-gap) grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" style={{ gap: "var(--spacing-card-padding)" }}>
          {examplePhotos.map((src, index) => (
            <div
              key={src}
              className="relative aspect-9/16 overflow-hidden card"
            >
              <ImageLightbox src={src} alt={exampleAlts[index]} fill className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      <CtaSection
        heading={t("cta.heading")}
        description={t("cta.description")}
        primaryAction={{ label: t("cta.download"), href: taglyAppHref }}
        secondaryAction={{ label: t("cta.readFaq"), href: "/for-customers/faq" }}
      />
    </main>
  );
}
