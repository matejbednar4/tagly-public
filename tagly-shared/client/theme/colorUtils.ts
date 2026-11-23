/**
 * Theme color helpers.
 *
 * `withAlpha` derives a translucent variant of a solid theme hex (e.g. the ink
 * focus ring or a muted disabled fill) so those values stay anchored to the
 * token instead of being hardcoded — change `color.ink` and every ring/overlay
 * derived from it follows. Used by the input focus/error rings and the disabled
 * button fill.
 */

/** Convert a `#rrggbb` (or `#rgb`) hex to an `rgba()` string at the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
