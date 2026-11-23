import type { ReactNode } from "react";

type FaqItem = {
  question: string;
  answer: string;
  answerContent?: ReactNode;
};

type FaqSectionProps = {
  heading: string;
  items: FaqItem[];
  /**
   * Emit the FAQPage JSON-LD for this section's items. Schema.org and Google
   * expect exactly ONE FAQPage entity per URL, so a page that renders several
   * FaqSections must set this to false on all of them and render a single
   * <FaqJsonLd> with every question instead (see src/app/[lng]/faq/page.tsx).
   * Defaults to true, which is correct for the pages with one FAQ section.
   */
  renderJsonLd?: boolean;
};

/**
 * The page's single FAQPage entity. `item.answer` is the plain-text twin of the
 * rendered answer (the `*Inline` <Trans> variants add links and nothing else),
 * so the structured data mirrors the visible Q&A.
 */
export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function FaqSection({
  heading,
  items,
  renderJsonLd = true,
}: FaqSectionProps) {
  return (
    <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
      {renderJsonLd ? <FaqJsonLd items={items} /> : null}
      <div className="mx-auto max-w-200">
        <h2 className="text-style-h2 text-text desktop:text-center">{heading}</h2>
        <div className="mt-(--spacing-block-gap)">
          {items.map((item) => (
            <details
              key={item.question}
              className="group border-b border-divider py-(--spacing-element-gap) first:pt-0 last:border-b-0 last:pb-0"
            >
              <summary className="group/summary flex cursor-pointer items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                <h3 className="relative text-style-h3 text-text after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-text after:transition-transform after:duration-200 after:ease-out group-hover/summary:after:scale-x-100">
                  {item.question}
                </h3>
                <svg
                  className="ml-(--spacing-card-padding) h-5 w-5 shrink-0 text-text-tertiary transition-transform duration-200 group-open:rotate-180"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <p className="mt-(--spacing-card-padding) text-style-body text-text-secondary">
                {item.answerContent ?? item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
