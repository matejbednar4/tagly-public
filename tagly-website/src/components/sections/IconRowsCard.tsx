import type { ReactNode } from "react";

export type IconRow = {
  icon: ReactNode;
  title: string;
  /** Optional — a row can be a single full-sentence title (the landing's
   *  "why" points follow the sales one-pager, where two of three points are
   *  one sentence long). */
  body?: string;
};

/**
 * A single white card of icon-led rows split by hairline dividers — the
 * design system's sanctioned border use. Ported from the join page's
 * "Why do you get paid?" card and the apps' RewardInfoSheet: each row leads
 * with its icon in a small colored circle (butter or blue — the two
 * sanctioned accents), then a bold title and a secondary-body explanation.
 *
 * Used by the landing page's "Why Tagly works" (brand/butter) and "What
 * decides the price" (accent/blue) sections.
 */
export function IconRowsCard({
  items,
  tone,
}: {
  items: IconRow[];
  tone: "brand" | "accent";
}) {
  const circleClasses =
    tone === "brand"
      ? "bg-brand text-on-brand"
      : "bg-accent text-on-accent";

  return (
    <div className="mx-auto max-w-160 card">
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex items-start gap-(--spacing-element-gap) p-(--spacing-element-gap) ${
            index > 0 ? "border-t border-divider" : ""
          }`}
        >
          <span
            className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-max ${circleClasses}`}
            aria-hidden
          >
            {item.icon}
          </span>
          <div>
            <h3 className="text-style-body-bold text-text">{item.title}</h3>
            {item.body && (
              <p className="mt-1 text-style-small-body text-text-secondary">
                {item.body}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
