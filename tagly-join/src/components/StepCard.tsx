import { STEP_IMAGE_SIZE } from "@/lib/constants/copy";

type Props = {
  kicker: string;
  title: string;
  description: string;
  image: string;
};

/**
 * White surface card lifted by the warm card shadow (no border — separation
 * comes from shadow, per the design system). The step label sits in a butter
 * pill, the one sanctioned accent on the card.
 *
 * The label is free text, not a number: the four slides this mirrors (the
 * customer app's onboarding carousel) are three numbered steps plus a "Why it
 * works" payoff.
 *
 * **A row, not a tile.** The four steps were a 2-column grid of image-above-
 * copy tiles, which capped the artwork at half the page column (~167px on a
 * phone). They are now full-width rows stacked one per line, artwork left at
 * 56% of the card and the copy centred beside it — so the phone mockup renders
 * ~192px wide (bigger than the grid) without the section growing as tall as a
 * full-width-image stack would. The 56% is deliberate rather than a round 60:
 * it is the most that can go to the artwork while the copy column still holds
 * ~126px, below which a title like "Post an Instagram story from your visit"
 * starts breaking mid-phrase on every line.
 *
 * The artwork is a transparent-background phone mockup that the app renders on
 * cream; white is a half-shade off cream by design, so it sits on the card
 * unchanged, flush to the card's left/top/bottom edges. `width`/`height` come
 * from the shared frame size so the browser reserves the box before the image
 * loads.
 *
 * The description is always visible. It used to hide behind a per-card "Show
 * more" toggle, which meant four taps to read four one-line sentences — and
 * that toggle was the only reason this needed to be a client component. It is
 * now a plain server component with no JS.
 */
export function StepCard({ kicker, title, description, image }: Props) {
  return (
    <div
      className="flex items-center gap-(--spacing-tight-gap) rounded-lg overflow-hidden bg-surface"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <img
        src={image}
        alt={title}
        width={STEP_IMAGE_SIZE.width}
        height={STEP_IMAGE_SIZE.height}
        className="w-[56%] shrink-0 h-auto block"
      />
      <div className="min-w-0 flex flex-col gap-(--spacing-tight-gap) py-(--spacing-card-padding) pr-(--spacing-card-padding)">
        <span
          className="inline-flex items-center justify-center self-start rounded-max bg-brand text-on-brand text-style-small-body-bold px-2.5 py-0.5"
          aria-hidden
        >
          {kicker}
        </span>
        <p className="text-style-h4 text-ink">{title}</p>
        <p className="text-style-small-body text-text-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}
