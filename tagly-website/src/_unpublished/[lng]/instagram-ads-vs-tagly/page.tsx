import type { Metadata } from "next";
import { Trans } from "react-i18next/TransWithoutContext";
import { Button } from "@/components/ui/Button";
import { PressableText } from "@/components/ui/PressableText";
import { CtaSection } from "@/components/sections/CtaSection";
import {
  Target,
  DollarSign,
  Users,
  Camera,
  ShieldCheck,
  Clock,
  GraduationCap,
  Wallet,
  Globe,
  ShoppingCart,
  RotateCcw,
  BarChart3,
  MapPin,
} from "lucide-react";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "instagram-ads-vs-tagly");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, "/instagram-ads-vs-tagly"),
    openGraph: { title, description },
  };
}

const sectionClass =
  "mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)";

const rowIcons = [Target, DollarSign, Users, Camera, ShieldCheck, Clock, GraduationCap, Wallet];
const whyIcons = [Camera, Target, ShieldCheck, Clock, DollarSign, GraduationCap];
const worksIcons = [Globe, ShoppingCart, RotateCcw, BarChart3, MapPin];

export default async function InstagramAdsVsTaglyPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, ["instagram-ads-vs-tagly", "comparison", "common"]);

  const rows = t("table.rows", { returnObjects: true }) as Array<{
    label: string;
    competitor: string;
    tagly: string;
  }>;
  const whyItems = t("whyBetter.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  const worksItems = t("worksWell.items", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;

  return (
    <main>
      <section className={`${sectionClass} pt-(--spacing-section-gap)`}>
        <div className="mx-auto max-w-200">
          <h1 className="text-style-h1 text-text desktop:text-center">
            {t("hero.title")}
          </h1>
          <h2 className="mt-(--spacing-tight-gap) text-style-h2 text-text-secondary desktop:text-center">
            {t("hero.subtitle")}
          </h2>
          <p className="mt-(--spacing-element-gap) text-style-lead text-text-secondary desktop:text-center">
            <Trans
              t={t}
              i18nKey="hero.intro"
              components={{
                restaurants: <PressableText href="/restaurants" />,
                cafes: <PressableText href="/cafes" />,
                gyms: <PressableText href="/gyms" />,
                local: <PressableText href="/local-businesses" />,
              }}
            />
          </p>
          <div className="mt-(--spacing-block-gap) flex flex-row items-center desktop:justify-center">
            <Button type="primary" size="large" label={t("common:getInTouch")} href="/#contact" />
            <div className="ml-(--spacing-card-padding)">
              <Button type="secondary" size="large" label={t("comparison:seeHowTaglyWorks")} href="/how-it-works" />
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("comparison:sideBySide")}
        </h2>
        <div className="mt-(--spacing-block-gap) mx-auto max-w-200 overflow-x-auto">
          <table className="w-full border-collapse text-style-body text-text">
            <thead>
              <tr className="border-b-2 border-border-strong">
                <th className="py-(--spacing-card-padding) pr-(--spacing-card-padding) text-left text-style-body-bold"></th>
                <th className="py-(--spacing-card-padding) px-(--spacing-card-padding) text-left text-style-body-bold text-text-secondary">
                  {t("table.competitor")}
                </th>
                <th className="py-(--spacing-card-padding) pl-(--spacing-card-padding) text-left text-style-body-bold text-text">
                  {t("comparison:columnTagly")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const Icon = rowIcons[index];
                return (
                  <tr key={index} className="border-b border-divider">
                    <td className="py-(--spacing-card-padding) pr-(--spacing-card-padding) text-style-body-bold align-top desktop:whitespace-nowrap">
                      <Icon className="mb-(--spacing-tight-gap) text-ink desktop:hidden" size={16} aria-hidden="true" />
                      <span className="hidden desktop:flex desktop:items-center">
                        <Icon className="mr-(--spacing-tight-gap) shrink-0 text-ink" size={16} aria-hidden="true" />
                        {row.label}
                      </span>
                      <span className="desktop:hidden">{row.label}</span>
                    </td>
                    <td className="py-(--spacing-card-padding) px-(--spacing-card-padding) text-text-secondary align-top">
                      {row.competitor}
                    </td>
                    <td className="py-(--spacing-card-padding) pl-(--spacing-card-padding) text-text align-top">
                      {row.tagly}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-style-h2 text-text desktop:text-center">
          {t("comparison:whyBetter")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary desktop:text-center">
          {t("whyBetter.intro")}
        </p>

        <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-2">
          {whyItems.map((item, index) => {
            const Icon = whyIcons[index];
            return (
              <article
                key={index}
                className={`card p-(--spacing-element-gap) ${
                  index % 2 === 0
                    ? "sm:mr-(--spacing-card-padding)"
                    : "sm:ml-(--spacing-card-padding)"
                } ${index >= 2 ? "mt-(--spacing-element-gap)" : index === 1 ? "mt-(--spacing-element-gap) sm:mt-0" : ""}`}
              >
                <Icon className="text-ink" size={36} aria-hidden="true" />
                <h3 className="mt-(--spacing-card-padding) text-style-h3 text-text">
                  {item.title}
                </h3>
                <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
                  {item.description}
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
              {t("worksWell.title")}
            </h2>
            <p className="mt-(--spacing-element-gap) text-style-body text-on-ink/80 desktop:text-center">
              {t("worksWell.intro")}
            </p>
          </div>
          <div className="mt-(--spacing-block-gap) grid grid-cols-1 sm:grid-cols-2">
            {worksItems.map((item, index) => {
              const Icon = worksIcons[index];
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
                    {item.title}
                  </h3>
                  <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mx-auto max-w-160">
          <h2 className="text-style-h2 text-text desktop:text-center">
            {t("comparison:bottomLine")}
          </h2>
          <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary desktop:text-center">
            {t("bottomLine.p1")}
          </p>
          <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary desktop:text-center">
            {t("bottomLine.p2")}
          </p>
          <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary desktop:text-center">
            <Trans
              t={t}
              i18nKey="bottomLine.p3"
              components={{
                pricing: <PressableText href="/pricing" />,
                faq: <PressableText href="/faq" />,
              }}
            />
          </p>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="card p-(--spacing-element-gap) desktop:p-(--spacing-block-gap) desktop:text-center">
          <h2 className="text-style-h2 text-text">{t("comparison:otherComparisons")}</h2>
          <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
            <Trans
              t={t}
              i18nKey="other.intro"
              components={{
                influencer: <PressableText href="/influencer-marketing-vs-tagly" />,
                agencies: <PressableText href="/marketing-agencies-vs-tagly" />,
              }}
            />
          </p>
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
