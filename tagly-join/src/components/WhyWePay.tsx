import { getTranslation } from "@/i18n";
import type { Language } from "@/i18n/settings";
import { WHY_REASONS } from "@/lib/constants/copy";

/**
 * Inline outline SVGs rather than an icon package: the apps use Ionicons via
 * @expo/vector-icons, which is React Native only, so this page hand-draws the
 * same outline weight (24px box, 1.75 stroke, round caps) — matching the
 * hero's social-proof glyph and the footer's social icons.
 */
const ICONS: Record<(typeof WHY_REASONS)[number]["icon"], React.ReactElement> = {
  // wallet — the business's topped-up balance
  wallet: (
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V9M3 8.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M3 8.5A2.5 2.5 0 0 0 5.5 11H19a2 2 0 0 1 2 2v2m0 0h-4a2 2 0 1 1 0-4h4" />
  ),
  // two people — friends watching, rather than strangers scrolling past.
  // (Was a location pin while reason 2 argued local reach; the copy now
  // argues friends vs strangers, so the glyph follows the argument.)
  people: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.25 19.5a5.75 5.75 0 0 1 11.5 0" />
      <path d="M15.5 5.15a3.25 3.25 0 0 1 0 5.7" />
      <path d="M17 14.4a5.75 5.75 0 0 1 3.75 5.1" />
    </>
  ),
};

/**
 * Answers the page's central objection: why would anyone pay me for a story?
 *
 * Placed straight after the earnings scroller, because that is where the doubt
 * peaks — someone has just read that a share earned real money and immediately
 * wants to know who is funding it and why that is sustainable. The store CTA
 * follows this section rather than preceding it, so the button is pressed by
 * someone who believes the offer.
 *
 * Rows in one card, split by hairline dividers — the design system's sanctioned
 * border use, and visually distinct from the card grids above and below it.
 * Each row is led by its icon in a butter circle, the same small-accent
 * treatment as the step number pill.
 */
export async function WhyWePay({ lng }: { lng: Language }) {
  const { t } = await getTranslation(lng, "copy");

  return (
    <section className="mb-(--spacing-section-gap)">
      <h2 className="text-style-h2 text-ink mb-(--spacing-tight-gap) text-center">
        {t("whyHeading")}
      </h2>
      <p className="text-style-body text-text-secondary mb-(--spacing-element-gap) text-center">
        {t("whyLead")}
      </p>

      <div
        className="bg-surface rounded-lg"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {WHY_REASONS.map((reason, i) => (
          <div
            key={reason.titleKey}
            className={`flex gap-(--spacing-card-padding) p-(--spacing-card-padding) ${
              i > 0 ? "border-t border-divider" : ""
            }`}
          >
            <span
              className="shrink-0 flex items-center justify-center w-10 h-10 rounded-max bg-brand text-on-brand"
              aria-hidden
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[reason.icon]}
              </svg>
            </span>
            <div>
              <p className="text-style-body-bold text-ink">
                {t(reason.titleKey)}
              </p>
              <p className="text-style-small-body text-text-secondary mt-1">
                {t(reason.bodyKey)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
