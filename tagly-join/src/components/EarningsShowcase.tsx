import Image from "next/image";
import { getTranslation } from "@/i18n";
import type { Language } from "@/i18n/settings";
import { EARNINGS_SHARES } from "@/lib/constants/copy";

// Card width (9:16 image, so 144 x 256). Sized so a THIRD card is always
// clipped by the screen edge, which is what actually signals "scrollable" —
// at the previous 176 the second card ended at 384px and the third began at
// 392, off-screen on a 390px phone, so the row looked like a static pair.
// At 144: cards start at 24 / 176 / 328, leaving ~62px of the third in view on
// a 390px phone and ~47px on a 375px one.
const CARD_WIDTH_CLASS = "w-36";

/**
 * "See how much others are earning" — a horizontal scroller of real story cards
 * (9:16), each one the story itself with a frosted panel over its head carrying
 * the reward it paid, its reach and the venue. Replaces the old two-row
 * estimate table, which asked people to imagine a number instead of showing
 * them one.
 *
 * Every figure is from a real share. The amounts come from copy.json per locale
 * — USD for English readers, the CZK equivalent for Czech ones (a static
 * conversion; see EARNINGS_SHARES for the rate and when it was taken).
 */
export async function EarningsShowcase({ lng }: { lng: Language }) {
  const { t } = await getTranslation(lng, "copy");

  return (
    <section className="mb-(--spacing-section-gap)">
      {/* 8 here, not 24: the track carries 16 of its own top padding (see
          below), so the heading still clears the cards by the usual 24. */}
      <h2 className="text-style-h2 text-ink mb-(--spacing-tight-gap) text-center">
        {t("earningsHeading")}
      </h2>

      {/* Full-bleed: the track runs edge to edge so a card is always clipped by
          the screen edge (the affordance that says "swipe"), while the padding
          keeps the FIRST card aligned with the rest of the page and gives the
          LAST one the same breathing room at the end.
          The scroll container IS the flex container, deliberately. With an
          inner `w-max` wrapper carrying the padding, `width: max-content` under
          `box-sizing: border-box` folds that padding into the content
          measurement and the inline padding collapses, so the first card sat
          flush against the screen edge.
          Vertical padding matters too: setting overflow-x forces overflow-y to
          compute to auto, so without it the box clips the cards' warm shadow
          flat along the top and bottom. `scroll-p` keeps snapped cards from
          landing under the padding. */}
      <div className="-mx-(--spacing-page-horizontal-padding) flex gap-(--spacing-tight-gap) overflow-x-auto px-(--spacing-page-horizontal-padding) py-(--spacing-card-padding) snap-x snap-mandatory scroll-p-(--spacing-page-horizontal-padding) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {EARNINGS_SHARES.map((share) => (
          <article
            key={share.index}
            className={`relative snap-start shrink-0 ${CARD_WIDTH_CLASS} aspect-9/16 bg-surface rounded-lg overflow-hidden`}
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {/* The card IS the story now — the figures used to sit in a white
                block stacked above the photo, which spent a third of the card's
                height on chrome and made each one read as a caption rather than
                as this story's result. */}
            <Image
              src={share.image}
              alt={t("exampleImageAlt", { index: share.index })}
              fill
              sizes="144px"
              className="object-cover"
            />

            {/* Frosted panel over the HEAD of the photo — the money is the
                reason the card exists, so it sits where the eye lands first,
                and the story reads underneath it uninterrupted. The photo box
                itself stays a full 9:16; the panel floats on top of it rather
                than taking any of its height. Mostly-opaque cream + a LIGHT
                few-px blur (the exact pair below is tuned by eye, so it is
                deliberately not quoted here)
                rather than a solid fill or a dark scrim: the point is that the
                photo visibly continues underneath, so the blur only has to
                soften detail enough for ink to hold — a heavy blur erased the
                shapes and the panel stopped reading as glass over a photo. The
                opacity carries the legibility instead. Cream, not white, so
                the panel belongs to the page rather than looking like a
                screenshot artifact.
                `-webkit-` twin is not optional: Safari (iOS especially, where
                most of this traffic lands) still needs the prefix, and without
                it the panel degrades to a flat wash with no blur at all.
                The WHOLE panel — position, insets, padding, the flex column —
                is inline rather than utility classes, deliberately: every one
                of these is load-bearing over a photo, and a utility that has
                not made it into the stylesheet yet (a stale dev chunk, a
                cached CSS file) degrades this into shrink-wrapped, unpadded
                text sitting directly on the image. Inline styles ship with the
                markup and cannot go missing. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                // 12 = the app's compact card padding; the panel sits ON the
                // photo, so it takes as little of it as it can.
                padding: 12,
                backgroundColor: "rgba(255, 252, 242, 0.7)",
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
              }}
            >
              {/* Two tiers, not three: the money leads (24px green `amount`),
                  and reach + venue now share one voice — same `micro` size,
                  same secondary brown, each led by its own 12px glyph — so they
                  read as two facts about the same story instead of a caption
                  followed by an afterthought. 12 of padding (the app's compact
                  card padding) rather than 16: the panel sits on the photo, so
                  it should take as little of it as it can. */}
              <span className="text-style-amount">{t(share.rewardKey)}</span>
              <span className="flex items-center gap-1 text-style-micro text-text-secondary">
                {/* people — reach is people reached, not impressions */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden
                >
                  <circle cx="9" cy="8" r="3.25" />
                  <path d="M3.25 19.5a5.75 5.75 0 0 1 11.5 0" />
                  <path d="M15.5 5.15a3.25 3.25 0 0 1 0 5.7" />
                  <path d="M17 14.4a5.75 5.75 0 0 1 3.75 5.1" />
                </svg>
                {t("earningsReachLabel", { reach: t(share.reachKey) })}
              </span>
              {/* Instagram's own location sticker is already in the photo, but
                  at this card width it renders ~6px tall, so the venue needs
                  saying here — with a pin so it reads as a place, not a
                  caption. */}
              <span className="flex items-center gap-1 text-style-micro text-text-secondary min-w-0">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden
                >
                  <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                <span className="truncate">{share.business}</span>
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* 8 for the same reason as the heading — the track's own 16 of bottom
          padding completes the 24 gap. */}
      <p className="text-style-small-body text-text-tertiary mt-(--spacing-tight-gap) text-center">
        {t("earningsDisclaimer")}
      </p>
    </section>
  );
}
