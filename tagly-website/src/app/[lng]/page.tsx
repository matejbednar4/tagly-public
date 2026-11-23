import type { Metadata } from "next";
import Image from "next/image";
import {
  Calendar,
  Eye,
  MapPin,
  Receipt,
  Repeat,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { ExplainerVideo } from "@/components/ui/ExplainerVideo";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ScrollCue } from "@/components/ui/ScrollCue";
import { ScrollLinkButton } from "@/components/ui/ScrollLinkButton";
import { IconRowsCard } from "@/components/sections/IconRowsCard";
import { ContactForm } from "@/components/contact/ContactForm";
import { fetchPublicStats } from "@/lib/fetchPublicStats";
import { getTranslation } from "@/lib/i18n";
import { buildAlternates } from "@/lib/i18n/metadata";

/**
 * Rendered per request, NOT prerendered — this is what keeps the hero's live
 * customer count live.
 *
 * The fetch inside `fetchPublicStats` carries `revalidate: 300`, which on a
 * statically-rendered route makes the whole PAGE an ISR entry (observed in
 * production: `x-nextjs-cache: HIT`, `s-maxage=300,
 * stale-while-revalidate=31535700`). That entry was not being regenerated on
 * Amplify: on 2026-08-30 the API reported 5,248 customers, join.taglyapp.com
 * (which renders per request) showed 5,248, and this page served a frozen
 * 3,769 on five consecutive requests — roughly 1,500 signups behind.
 *
 * tagly-join never hit this because its page awaits `searchParams`/`headers()`
 * and is therefore dynamic by construction; the only cache in front of the
 * API is the 5-minute fetch data cache. This forces the same shape here, so
 * the count is at most 5 minutes stale instead of frozen at deploy time.
 * (Explicit per-fetch `revalidate` still wins over the segment's no-store
 * default, so the API is still hit at most once per 5 minutes, not per view.)
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>;
}): Promise<Metadata> {
  const { lng } = await params;
  const { t } = await getTranslation(lng, "home");
  const title = t("meta.title");
  const description = t("meta.description");

  return {
    title,
    description,
    alternates: buildAlternates(lng, ""),
    openGraph: { title, description, images: ["/og-image.png"] },
  };
}

// Section anchors are ENGLISH in both locales — they are part of the URL
// (`/#pricing`), and the Navbar's section links must always match this set.
const HOW_IT_WORKS_ID = "how-it-works";
const WHY_TAGLY_ID = "why-tagly";
const EXAMPLES_ID = "examples";
const PRICING_ID = "pricing";
const CONTACT_ID = "contact";

// The how-it-works cards follow the sales one-pager's three steps, which walk
// the CUSTOMER through the flow as the business owner watches: they share you
// (advertiser onboarding slide 2) -> they approve it in our app (customer
// onboarding slide 1) -> they get rewarded (advertiser onboarding slide 3).
// Artwork is copied from the apps' assets; keep images in sync with the apps
// when their carousels change.
const landingStepImages = (lng: string) => {
  const l = lng === "cs" ? "cs" : "en";
  return [
    `/images/how-it-works/advertisers/${l}/step-2.webp`,
    `/images/how-it-works/customers/${l}/step-1.webp`,
    `/images/how-it-works/advertisers/${l}/step-3.webp`,
  ];
};

/**
 * Real shares from the join page's showcase (images copied from
 * tagly-join/public/images/examples; the join page's first share was dropped
 * from this page on Matej's call, 2026-08-08) — the card leads with the
 * REACH the share got, with the price the business paid as a secondary line
 * (reward is 60% of the price; Tagly's commission is the other 40%).
 *
 * The venue is a proper noun, identical in every locale, so it lives here
 * rather than in home.json. Prices are CZK in both locales (the market is
 * Prague): USD price paid = reward / 0.6, converted at the join page's static
 * rate (1 USD = 20.985 CZK, frankfurter.app 2026-08-03) and rounded to whole
 * crowns — $4.10/0.6 -> 143, $7.50/0.6 -> 262, $4.50/0.6 -> 157. Re-derive
 * alongside the join page if the crown moves far enough to matter.
 *
 * `spent` is what the posting customer spent at the venue on that visit —
 * the figure that shows the business comes out ahead either way. Real figures
 * from these shares (Matej, 2026-08-09).
 */
const EXAMPLE_SHARES = [
  {
    image: "/images/examples/2.karawba.jpg",
    business: "Karawba",
    price: "143 Kč",
    reach: "152",
    spent: "158 Kč",
  },
  {
    image: "/images/examples/3.loftn8.jpg",
    business: "Loft N8",
    price: "262 Kč",
    reach: "526",
    spent: "630 Kč",
  },
  {
    image: "/images/examples/4.s74winecafe.jpg",
    business: "S74 wine&café",
    price: "157 Kč",
    reach: "131",
    spent: "120 Kč",
  },
] as const;

/**
 * The trust strip under the hero. A hand-curated list, deliberately NOT
 * fetched from the backend (Matej's call 2026-08-09): who appears here is an
 * editorial decision — permission given, still a happy customer, recognizable
 * name — and the strip must never auto-show a business that churned or never
 * agreed. Proper nouns, identical in both locales. Styled wordmarks BY
 * DESIGN, not as a stopgap (2026-08-09): several venues have no logo at all
 * (Felicity), and a uniform type treatment beats a mixed wall of logo files
 * anyway — don't start collecting logos for this.
 */
const TRUSTED_BUSINESSES = [
  "Dim Sum Spot",
  "Loft N8",
  "Berry Good",
  "Černomorka",
  "Karawba",
] as const;

// Row icons for the "why" and "price" cards. Outline weight matches the apps'
// Ionicons (thin strokes, round caps); the pricing list mirrors the apps'
// RewardInfoSheet factor order exactly.
const iconProps = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const WHY_ICONS = [Wallet, MapPin, Zap];
const PRICING_ICONS = [Eye, MapPin, Users, Sparkles, Calendar, Repeat];

/**
 * Renders a translated line with its already-formatted count emphasised in
 * ink. The line is split around the rendered number rather than putting
 * markup into the translation, which keeps home.json HTML-free and works
 * whichever side of the number the language puts its words. `font-medium`,
 * not <strong>'s default bold — Stack Sans tops out at weight 500, so
 * emphasis comes from color.
 *
 * With `loading`, the number's slot renders as a pulsing skeleton pill
 * instead — used while we have no real count (the server-side stats fetch
 * returned null), which beats printing a literal "0". The page is
 * server-rendered, so the pill resolves on the next successful ISR
 * revalidate, not client-side.
 */
function EmphasizedCount({
  line,
  formatted,
  loading = false,
}: {
  line: string;
  formatted: string;
  loading?: boolean;
}) {
  const at = line.indexOf(formatted);
  if (at === -1) return line;
  return (
    <>
      {line.slice(0, at)}
      {loading ? (
        <span
          aria-hidden
          className="inline-block rounded-max bg-divider animate-pulse"
          style={{
            width: "2.75em",
            height: "0.85em",
            verticalAlign: "-0.05em",
          }}
        />
      ) : (
        <strong className="text-ink font-medium">{formatted}</strong>
      )}
      {line.slice(at + formatted.length)}
    </>
  );
}

/** The one CTA every section funnels into: scroll to the contact form. */
function SectionCta({ label }: { label: string }) {
  return (
    <div className="mt-(--spacing-block-gap) text-center">
      <ScrollLinkButton
        type="primary"
        size="small"
        label={label}
        targetId={CONTACT_ID}
      />
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  const { t } = await getTranslation(lng, ["home", "common"]);
  const stepImages = landingStepImages(lng);
  const stats = await fetchPublicStats();

  const steps = t("howItWorks.steps", { returnObjects: true }) as Array<{
    kicker: string;
    title: string;
    alt: string;
  }>;
  const whyPoints = t("whyChoose.points", { returnObjects: true }) as Array<{
    title: string;
    body?: string;
  }>;
  const pricingFactors = t("pricing.factors", {
    returnObjects: true,
  }) as Array<{ title: string; body: string }>;
  // One alt per share, indexed alongside EXAMPLE_SHARES: these are real,
  // visually distinct stories, so a single templated alt described none of them.
  const exampleAlts = t("examples.alts", { returnObjects: true }) as string[];
  const ctaLabel = t("common:getInTouch");

  // The hero differs by locale, not just in copy — see the comment on the
  // section below.
  // The live CUSTOMER count lives in the hero subtitle, rendered
  // UNCONDITIONALLY — Matej's call (2026-08-08): production is well
  // populated, so the sentence always shows a figure. When the stats fetch
  // returns null (missing API_BASE_URL / backend down) the number's slot
  // renders as a skeleton pill instead of a literal "0". The sentinel picks
  // the plural sentence a large count would ("lidí"/"people") and marks
  // where the pill goes; it never reaches the reader as text.
  const numberLocale = lng === "cs" ? "cs-CZ" : "en-US";
  const statsLoading = stats === null;
  const customerCount = stats?.customerCount ?? 0;
  const COUNT_SENTINEL = "•••";
  const customerFormatted = statsLoading
    ? COUNT_SENTINEL
    : customerCount.toLocaleString(numberLocale);
  const subtitle = t("hero.subtitle", {
    count: statsLoading ? 1000 : customerCount,
    formatted: customerFormatted,
  });

  return (
    <main>
      {/* The hero is two layouts. Phones/tablets: the centred text block with
          the video, then the trust strip, stacked. Desktop (1200px+): a
          two-column row — video left, text right (row-reverse keeps the h1
          first in the DOM for semantics/SEO) — with the trust strip under
          it, stretched together to fill the first viewport (minus the
          navbar), and the ScrollCue chevron pinned at the fold since nothing
          peeks above it anymore. */}
      <section className="relative mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) py-(--spacing-section-gap) desktop:flex desktop:min-h-(--spacing-hero-min-height) desktop:flex-col desktop:justify-center desktop:px-(--spacing-page-horizontal-padding-lg) desktop:pt-(--spacing-block-gap) desktop:pb-(--spacing-section-gap)">
        <div className="desktop:flex desktop:flex-row-reverse desktop:items-center desktop:gap-(--spacing-block-gap)">
          {/* The text column: centred and capped to a readable measure when
              stacked, left-aligned at natural column width in the row. It's
              a size container (@container) so the title's fluid font-size
              can measure against the column via cqw. */}
          <div className="@container mx-auto max-w-160 text-center desktop:mx-0 desktop:max-w-none desktop:flex-1 desktop:text-left">
            {/* Both locales' titles carry a \n after the comma;
                .text-style-h1-fit renders exactly those two lines at any
                width, shrinking the font when a line wouldn't fit. */}
            <h1 className="text-style-h1 text-style-h1-fit text-text">
              {t("hero.title")}
            </h1>
            {/* The subheading IS the customer-count social proof; the number
                is emphasised in ink. */}
            <p className="mt-(--spacing-element-gap) text-style-lead text-text-secondary">
              <EmphasizedCount
                line={subtitle}
                formatted={customerFormatted}
                loading={statsLoading}
              />
            </p>
            {/* Same button size as every other CTA on the page. */}
            <div className="mt-(--spacing-block-gap) flex justify-center desktop:justify-start">
              <ScrollLinkButton
                type="primary"
                size="small"
                label={ctaLabel}
                targetId={CONTACT_ID}
              />
            </div>
          </div>
          {/* The visual column, identical in both locales (the video's
              audio/subtitles are Czech — accepted on /en, see
              ExplainerVideo.tsx). Stacked: wider than the text measure so
              the video reads as the hero's visual, full-width within the
              page padding on phones. */}
          <div className="mx-auto mt-(--spacing-block-gap) w-full max-w-200 desktop:mx-0 desktop:mt-0 desktop:max-w-none desktop:flex-1">
            <ExplainerVideo label={t("video.label")} />
          </div>
        </div>

        {/* The trust strip: an uppercase micro overline + the curated venue
            names as styled wordmarks (Playfair, the venue-name face, muted to
            secondary so the strip reads as background credibility, not a
            section). It lives INSIDE the hero — it's the hero's social proof
            and part of the first viewport on desktop, sitting above the
            scroll cue. Section-gap above it (the next step up from the
            block gap), per Matej's call — the strip needs more air than the
            hero's internal rhythm gives. */}
        <div className="mt-(--spacing-section-gap)">
          <p className="text-style-micro uppercase tracking-widest text-text-tertiary text-center">
            {t("trustedBy.title")}
          </p>
          <ul className="mt-(--spacing-element-gap) flex flex-wrap justify-center gap-x-(--spacing-block-gap) gap-y-(--spacing-element-gap) list-none">
            {TRUSTED_BUSINESSES.map((business) => (
              <li
                key={business}
                className="text-style-h3 text-text-secondary whitespace-nowrap"
              >
                {business}
              </li>
            ))}
          </ul>
        </div>

        <ScrollCue
          targetId={HOW_IT_WORKS_ID}
          label={t("hero.scrollCue")}
          className="absolute bottom-(--spacing-element-gap) left-1/2 hidden -translate-x-1/2 desktop:flex"
        />
      </section>

      <section
        id={HOW_IT_WORKS_ID}
        className="pb-(--spacing-section-gap) scroll-mt-(--spacing-anchor-offset)"
      >
        <div className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) desktop:px-(--spacing-page-horizontal-padding-lg)">
          <h2 className="text-style-h2 text-text text-center">
            {t("howItWorks.title")}
          </h2>

          {/* Tablet and up (md:, 768px — deliberately NOT the site's 1200px
              desktop: variant): one centered-content row of three. Phones only:
              one join-style row card per line, content left-aligned. */}
          <div className="mt-(--spacing-block-gap) grid grid-cols-1 gap-(--spacing-element-gap) md:grid-cols-3 md:gap-(--spacing-block-gap)">
            {/* Each card: mobile mirrors the join page's StepCard row — artwork
                flush to the card's left edge at 56% width, copy beside it (card
                padding lives on the text column). Desktop flips to a tile —
                centered copy above, artwork below (image DOM-first for the row,
                md:order-last for the tile). */}
            {steps.map((card, index) => (
              <article
                key={index}
                className="card overflow-hidden flex items-center gap-(--spacing-tight-gap) md:flex-col md:text-center md:p-(--spacing-card-padding)"
              >
                <div className="w-[56%] shrink-0 md:order-last md:w-full md:shrink md:mt-auto md:pt-(--spacing-card-padding) flex justify-center">
                  <div className="relative w-full md:w-3/5 md:max-w-60 aspect-1097/1839">
                    <ImageLightbox
                      src={stepImages[index]}
                      alt={card.alt}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
                {/* Kicker + title only (subheadings were cut 2026-08-08 —
                    Matej's call). On the desktop tile the pill gets
                    extra breathing room above and below itself. */}
                {/* Step copy stays LEFT-aligned in the mobile row layout
                    (Matej's call 2026-08-09) and centres only on the md+
                    tile layout, like before. */}
                <div className="min-w-0 flex flex-col py-(--spacing-card-padding) pr-(--spacing-card-padding) md:p-0 md:pt-(--spacing-element-gap) md:items-center md:text-center">
                  <span className="inline-flex items-center justify-center self-start md:self-center rounded-max bg-accent text-on-accent text-style-small-body-bold px-2.5 py-0.5">
                    {card.kicker}
                  </span>
                  <h3 className="mt-(--spacing-tight-gap) md:mt-(--spacing-element-gap) text-style-h3 text-text">
                    {card.title}
                  </h3>
                </div>
              </article>
            ))}
          </div>

          <SectionCta label={ctaLabel} />
        </div>
      </section>

      <section
        id={WHY_TAGLY_ID}
        className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg) scroll-mt-(--spacing-anchor-offset)"
      >
        {/* Heading + three points straight from the sales one-pager — no lead
            line, matching it. */}
        <h2 className="text-style-h2 text-text text-center">
          {t("whyChoose.title")}
        </h2>
        <div className="mt-(--spacing-block-gap)">
          <IconRowsCard
            tone="brand"
            items={whyPoints.map((point, index) => {
              const Icon = WHY_ICONS[index];
              return {
                icon: <Icon {...iconProps} />,
                title: point.title,
                body: point.body,
              };
            })}
          />
        </div>

        <SectionCta label={ctaLabel} />
      </section>

      <section
        id={EXAMPLES_ID}
        className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg) scroll-mt-(--spacing-anchor-offset)"
      >
        <h2 className="text-style-h2 text-text text-center">
          {t("examples.title")}
        </h2>
        <p className="mt-(--spacing-element-gap) mx-auto max-w-160 text-style-body text-text-secondary text-center">
          {t("examples.intro")}
        </p>
        {/* Phones: one stacked ROW card per share, mirroring the
            how-it-works step cards — the full 9:16 story on the left, the
            stats beside it on the right (2026-08-09, Matej's call; this
            replaced full-width stacked 9:16 cards, whose photos ate the
            screen). The stats column's background is the same frosted-blur
            treatment as the desktop overlay, not a plain surface: the story
            image repeats underneath it (cover-cropped, decorative) so the
            backdrop blur has something real to frost.
            Tablet and up (md:, matching how-it-works): the same three-column
            grid as before — full-card photo with the frosted panel overlaid
            on its head — capped at the content column so the cards don't
            balloon on desktop. */}
        <div className="mt-(--spacing-block-gap) mx-auto max-w-160 grid grid-cols-1 gap-(--spacing-element-gap) md:grid-cols-3 md:gap-(--spacing-card-padding)">
          {EXAMPLE_SHARES.map((share, index) => (
            <div
              key={share.image}
              className="relative flex md:block overflow-hidden card"
              /* Container for the cqw font sizing of the stat lines below —
                 viewport units can't size text to the CARD; container-query
                 units can. */
              style={{ containerType: "inline-size" }}
            >
              {/* The story itself — full 9:16, never cropped. 40% of the row
                  on phones (the steps use 56%, but here the stat lines need
                  the wider column); the whole card on md+. */}
              <div className="relative w-[40%] shrink-0 aspect-9/16 md:w-full">
                <ImageLightbox
                  src={share.image}
                  alt={exampleAlts[index]}
                  fill
                  className="object-cover"
                />
              </div>

              {/* The stats column (phones) / overlay panel (md+). On phones
                  it fills the rest of the row; on md+ it turns absolute and
                  sits over the head of the story, join-page pattern (the
                  figure is why the card exists, so it lands where the eye
                  does, and the story reads underneath). */}
              <div className="relative flex-1 md:absolute md:top-0 md:inset-x-0">
                {/* Phones only: the same story again, cover-cropped, purely
                    as the frosted panel's backdrop — on md+ the panel sits
                    on the real card photo, so this duplicate hides. */}
                <Image
                  src={share.image}
                  alt=""
                  fill
                  className="object-cover md:hidden"
                  aria-hidden
                />
                {/* The frost. Mostly-opaque cream + a light blur so the
                    photo visibly continues underneath; the paint styles are
                    inline deliberately — they are load-bearing over a photo
                    and inline they cannot go missing with a stale CSS chunk.
                    Position/centering live in classes because they differ
                    per breakpoint: on phones it fills the column and centers
                    its lines; on md+ it goes static so the wrapper takes its
                    height as the overlay panel. */}
                <div
                  className="absolute inset-0 flex flex-col justify-center md:static md:justify-start"
                  style={{
                    gap: 4,
                    padding: 12,
                    backgroundColor: "rgba(255, 252, 242, 0.7)",
                    backdropFilter: "blur(5px)",
                    WebkitBackdropFilter: "blur(5px)",
                  }}
                >
                  {/* Reach leads the card (the figure a business owner is
                      buying). Label and value share one NEVER-WRAPPING line;
                      the font size scales with the card width (cqw against
                      the card's inline-size container) so it stays a single
                      line on the narrowest phones. Clamp floor/ceiling keep
                      it readable and cap it at the amount style's 24px. Ink,
                      not green — green stays reserved for money. */}
                  <span
                    className="text-style-amount text-ink"
                    style={{
                      whiteSpace: "nowrap",
                      fontSize: "clamp(0.75rem, 12cqw, 1.5rem)",
                    }}
                  >
                    {t("examples.reachLabel")} {share.reach}
                  </span>
                  {/* The three secondary lines scale with the CARD width
                      like the reach line does (cqw + clamp): micro's 11px is
                      the floor, which is exactly what the ~205px desktop
                      grid cards resolve to, so desktop is unchanged; on
                      phones the card is the full column, growing the lines
                      to ~14px for readability (Matej's call 2026-08-09). The
                      em-sized icons ride along with the text. */}
                  {/* "Cena 143 Kč" — one line, never wrapping (Matej's call
                      2026-08-09: the label is just "Cena"/"Price"). */}
                  <span
                    className="flex items-center gap-1 text-style-micro text-text-secondary"
                    style={{
                      whiteSpace: "nowrap",
                      fontSize: "clamp(0.6875rem, 4cqw, 0.9375rem)",
                    }}
                  >
                    <Wallet
                      size={12}
                      strokeWidth={2}
                      className="shrink-0"
                      style={{ width: "1.1em", height: "1.1em" }}
                      aria-hidden
                    />
                    <span>
                      {t("examples.paidLabel")}{" "}
                      <strong className="text-success">{share.price}</strong>
                    </span>
                  </span>
                  {/* What the posting customer spent at the venue on that
                      visit — the price line's counterweight (the business
                      comes out ahead either way), so it sits right below it
                      in the same voice, amount in the same money green.
                      The one line long enough to overflow the phone layout's
                      stats column, so unlike its siblings it may wrap
                      between words; only the amount itself is unbreakable. */}
                  <span
                    className="flex items-center gap-1 text-style-micro text-text-secondary"
                    style={{ fontSize: "clamp(0.6875rem, 4cqw, 0.9375rem)" }}
                  >
                    <Receipt
                      size={12}
                      strokeWidth={2}
                      className="shrink-0"
                      style={{ width: "1.1em", height: "1.1em" }}
                      aria-hidden
                    />
                    <span>
                      {t("examples.spentLabel")}{" "}
                      <strong
                        className="text-success"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {share.spent}
                      </strong>
                    </span>
                  </span>
                  <span
                    className="flex items-center gap-1 text-style-micro text-text-secondary min-w-0"
                    style={{ fontSize: "clamp(0.6875rem, 4cqw, 0.9375rem)" }}
                  >
                    <MapPin
                      size={12}
                      strokeWidth={2}
                      className="shrink-0"
                      style={{ width: "1.1em", height: "1.1em" }}
                      aria-hidden
                    />
                    <span className="truncate">{share.business}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* No disclaimer line here (cut 2026-08-09 — Matej's call): the
            pricing section is one scroll below and answers the price
            question itself. */}
        <SectionCta label={ctaLabel} />
      </section>

      {/* The same six factors, in the same order and voice, as the apps'
          RewardInfoSheet (advertiser variant) — the sheet the business app
          opens from "See how we set the price". Qualitative only, no numbers;
          the algorithm stays private. */}
      <section
        id={PRICING_ID}
        className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg) scroll-mt-(--spacing-anchor-offset)"
      >
        <h2 className="text-style-h2 text-text text-center">
          {t("pricing.title")}
        </h2>
        <div className="mt-(--spacing-block-gap)">
          <IconRowsCard
            tone="accent"
            items={pricingFactors.map((factor, index) => {
              const Icon = PRICING_ICONS[index];
              return {
                icon: <Icon {...iconProps} />,
                title: factor.title,
                body: factor.body,
              };
            })}
          />
        </div>
        <p className="mt-(--spacing-element-gap) text-style-small-body text-text-secondary text-center">
          {t("pricing.footer")}
        </p>
        {/* No SectionCta here — the contact section itself is directly below. */}
      </section>

      {/* The contact form lives ON the landing page — every CTA above scrolls
          here, and every other page's sales CTA links to /#contact. The old
          /contact-sales route 301s here (next.config.ts). */}
      <section
        id={CONTACT_ID}
        className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg) scroll-mt-(--spacing-anchor-offset)"
      >
        <div className="mx-auto max-w-160">
          <h2 className="text-style-h2 text-text text-center">
            {t("contact.title")}
          </h2>
          <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary text-center">
            {t("contact.description")}
          </p>
          <div className="mt-(--spacing-block-gap)">
            <ContactForm />
          </div>
        </div>
      </section>
    </main>
  );
}
