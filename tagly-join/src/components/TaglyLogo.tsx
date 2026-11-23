import Image from "next/image";

// Intrinsic size of public/tagly-logo.png, kept here so the rendered box stays
// on the mark's real aspect ratio (it is very slightly taller than wide).
const SOURCE_WIDTH = 387;
const SOURCE_HEIGHT = 396;
const RENDER_HEIGHT = 32;
const RENDER_WIDTH = Math.round((RENDER_HEIGHT * SOURCE_WIDTH) / SOURCE_HEIGHT);

/**
 * The brand mark in the navbar. Previously a Playfair-bold "Tagly" text
 * wordmark standing in for artwork; this is the real logo — the ink "g" on
 * transparent, so it sits on the cream bar at 13.79:1 contrast.
 *
 * The mark alone is enough here: the word "Tagly" already appears in the
 * navbar CTA and repeatedly down the page, so repeating it in the logo added
 * nothing.
 *
 * `priority` because it is the topmost image on the page — without it Next
 * lazy-loads it and the bar renders empty for a beat on first paint.
 */
export function TaglyLogo() {
  return (
    <Image
      src="/tagly-logo.png"
      alt="Tagly"
      width={RENDER_WIDTH}
      height={RENDER_HEIGHT}
      priority
      className="block"
    />
  );
}
