import type { Metadata } from "next";
import { CtaSection } from "@/components/sections/CtaSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { PressableText } from "@/components/ui/PressableText";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "referrals");

  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: buildAlternates(lng, "/referrals"),
    openGraph: { title: t("meta.ogTitle"), description: t("meta.ogDescription") },
  };
}

function FlowchartArrow() {
  return (
    <div className="flex items-center justify-center py-(--spacing-card-padding)">
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none" className="text-ink">
        <path d="M12 0 L12 24 M6 18 L12 26 L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function FlowchartArrowHorizontal() {
  return (
    <div className="hidden desktop:flex items-center justify-center px-(--spacing-card-padding)">
      <svg width="32" height="24" viewBox="0 0 32 24" fill="none" className="text-ink">
        <path d="M0 12 L24 12 M18 6 L26 12 L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
    <div className="flex-1 card p-(--spacing-element-gap) text-center">
      <div className="mx-auto mb-(--spacing-card-padding) flex h-10 w-10 items-center justify-center rounded-max bg-brand text-style-body-bold text-on-brand">
        {number}
      </div>
      <h3 className="text-style-h3 text-text">{title}</h3>
      <p className="mt-(--spacing-card-padding) text-style-body text-text-secondary">
        {description}
      </p>
    </div>
  );
}

function PieChartSvg({
  percentage,
  decayedPercentage,
  rateLabel,
  size = 140,
}: {
  percentage: number;
  decayedPercentage: number;
  rateLabel: string;
  size?: number;
}) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const boostedDash = (percentage / 100) * circumference;
  const decayedDash = (decayedPercentage / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-divider)" strokeWidth="14" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-ink)" strokeWidth="14" strokeDasharray={`${boostedDash} ${circumference}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-ink)" strokeWidth="14" strokeDasharray={`${decayedDash} ${circumference}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} opacity="0.4" />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="middle" fill="var(--color-text)" className="text-style-h2" style={{ fontSize: "28px", fontWeight: 700 }}>
        {percentage}%
      </text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" dominantBaseline="middle" fill="var(--color-text-secondary)" style={{ fontSize: "11px", fontWeight: 500 }}>
        {rateLabel}
      </text>
    </svg>
  );
}

export default async function ReferralsPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, ["referrals", "common"]);

  const steps = t("steps.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const goodItems = t("good.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const faqItems = t("faq.items", { returnObjects: true }) as Array<{
    question: string;
    answer: string;
  }>;
  const rateLabel = t("rates.rateLabel");

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
          {t("steps.title")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary desktop:text-center">
          {t("steps.intro")}
        </p>

        <div className="mt-(--spacing-block-gap) flex flex-col desktop:hidden">
          {steps.map((step, index) => (
            <div key={index} className="contents">
              <FlowStep number={String(index + 1)} title={step.title} description={step.description} />
              {index < steps.length - 1 && <FlowchartArrow />}
            </div>
          ))}
        </div>

        <div className="mt-(--spacing-block-gap) hidden desktop:flex desktop:items-stretch">
          {steps.map((step, index) => (
            <div key={index} className="contents">
              <FlowStep number={String(index + 1)} title={step.title} description={step.description} />
              {index < steps.length - 1 && <FlowchartArrowHorizontal />}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("rates.title")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary desktop:text-center">
          {t("rates.intro")}
        </p>

        <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-2 gap-(--spacing-element-gap)">
          <article className="card p-(--spacing-block-gap) text-center">
            <div className="mx-auto mb-(--spacing-element-gap) flex h-12 w-12 items-center justify-center rounded-max bg-brand">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
                <path d="M9 9v.01" />
                <path d="M9 12v.01" />
                <path d="M9 15v.01" />
                <path d="M9 18v.01" />
              </svg>
            </div>
            <h3 className="text-style-h3 text-text">{t("rates.business.title")}</h3>
            <p className="mt-(--spacing-card-padding) text-style-body text-text-secondary">
              {t("rates.business.description")}
            </p>
            <div className="my-(--spacing-element-gap)">
              <PieChartSvg percentage={16} decayedPercentage={8} rateLabel={rateLabel} />
            </div>
            <div className="mx-auto max-w-72">
              <div className="flex items-center justify-center mb-(--spacing-tight-gap)">
                <span className="mr-(--spacing-tight-gap) inline-block h-3 w-3 rounded-max bg-ink shrink-0" />
                <span className="text-style-small-body text-text">{t("rates.business.legendBoosted")}</span>
              </div>
              <div className="flex items-center justify-center">
                <span className="mr-(--spacing-tight-gap) inline-block h-3 w-3 rounded-max bg-text-tertiary shrink-0" />
                <span className="text-style-small-body text-text">{t("rates.business.legendStandard")}</span>
              </div>
            </div>
          </article>

          <article className="card p-(--spacing-block-gap) text-center">
            <div className="mx-auto mb-(--spacing-element-gap) flex h-12 w-12 items-center justify-center rounded-max bg-brand">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="text-style-h3 text-text">{t("rates.customer.title")}</h3>
            <p className="mt-(--spacing-card-padding) text-style-body text-text-secondary">
              {t("rates.customer.description")}
            </p>
            <div className="my-(--spacing-element-gap)">
              <PieChartSvg percentage={8} decayedPercentage={4} rateLabel={rateLabel} />
            </div>
            <div className="mx-auto max-w-72">
              <div className="flex items-center justify-center mb-(--spacing-tight-gap)">
                <span className="mr-(--spacing-tight-gap) inline-block h-3 w-3 rounded-max bg-ink shrink-0" />
                <span className="text-style-small-body text-text">{t("rates.customer.legendBoosted")}</span>
              </div>
              <div className="flex items-center justify-center">
                <span className="mr-(--spacing-tight-gap) inline-block h-3 w-3 rounded-max bg-text-tertiary shrink-0" />
                <span className="text-style-small-body text-text">{t("rates.customer.legendStandard")}</span>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-(--spacing-element-gap) mx-auto max-w-160">
          <div className="card p-(--spacing-element-gap)">
            <div className="flex items-start">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-(--spacing-card-padding) mt-px shrink-0">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
              <div>
                <p className="text-style-body-bold text-text">{t("rates.stack.title")}</p>
                <p className="mt-(--spacing-tight-gap) text-style-body text-text-secondary">
                  {t("rates.stack.text")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-(--spacing-section-gap) desktop:mx-auto desktop:max-w-page-max-width desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="bg-ink p-(--spacing-element-gap) overflow-hidden desktop:rounded-lg desktop:p-(--spacing-block-gap)">
          <div className="mx-auto max-w-160">
            <h2 className="text-style-h2 text-on-ink desktop:text-center">
              {t("boost.title")}
            </h2>
            <p className="mt-(--spacing-element-gap) text-style-body text-on-ink/80 desktop:text-center">
              {t("boost.intro")}
            </p>

            <div className="mt-(--spacing-block-gap) rounded-lg bg-surface p-(--spacing-element-gap)">
              <div className="flex items-center mb-(--spacing-card-padding)">
                <div className="flex-1">
                  <p className="text-style-body-bold text-text">{t("boost.firstLabel")}</p>
                  <p className="text-style-small-body text-text-secondary">{t("boost.firstSub")}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-style-body-bold text-text">{t("boost.afterLabel")}</p>
                  <p className="text-style-small-body text-text-secondary">{t("boost.afterSub")}</p>
                </div>
              </div>
              <div className="relative h-3 w-full rounded-max bg-divider overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1/2 rounded-max bg-success" />
                <div className="absolute inset-y-0 right-0 w-1/2 rounded-max bg-success/30" />
              </div>
              <div className="flex items-center mt-(--spacing-card-padding)">
                <div className="flex-1">
                  <p className="text-style-small-body text-text">{t("boost.firstRates")}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-style-small-body text-text">{t("boost.afterRates")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <h2 className="text-style-h2 text-text desktop:text-center">{t("good.title")}</h2>
        <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-3 gap-(--spacing-element-gap)">
          {goodItems.map((item, index) => {
            const icons = [
              <path key="shield" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
              <g key="link">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </g>,
              <g key="info">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </g>,
            ];
            return (
              <article key={index} className="card p-(--spacing-element-gap)">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {icons[index]}
                </svg>
                <h3 className="mt-(--spacing-card-padding) text-style-h3 text-text">
                  {item.title}
                </h3>
                <p className="mt-(--spacing-card-padding) text-style-body text-text-secondary">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <FaqSection
        heading={t("faq.heading")}
        items={faqItems.map((item) => ({ question: item.question, answer: item.answer }))}
      />

      <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
        <div className="card p-(--spacing-element-gap) desktop:p-(--spacing-block-gap)">
          <h2 className="text-style-h2 text-text desktop:text-center">
            {t("learnMore.title")}
          </h2>
          <div className="mt-(--spacing-element-gap) flex flex-col gap-(--spacing-card-padding) desktop:flex-row desktop:flex-wrap desktop:items-center desktop:justify-center desktop:gap-0">
            {[
              { label: t("learnMore.howItWorks"), href: "/how-it-works" },
              { label: t("learnMore.pricing"), href: "/pricing" },
              { label: t("learnMore.faq"), href: "/faq" },
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
