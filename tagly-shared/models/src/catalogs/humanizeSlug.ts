// Last-resort fallback for catalog lookups: turn a raw slug into a readable
// label. Used by the FE localizer when a slug isn't in the bundled catalog
// (typically because the backend shipped a new slug ahead of the FE catalog
// update). Always English-ish — by definition we have no localized copy yet.
//
// Examples:
//   c.shares.rated                          → "Shares Rated"
//   a.balance.credit-purchase-completed     → "Balance Credit Purchase Completed"
//   pc.promo.complete-registration.h3       → "Promo Complete Registration H3"
//   coffee_shop                             → "Coffee Shop"
//   GEO_TOO_FAR                             → "Geo Too Far"
//   NO_INSTAGRAM                            → "No Instagram"

const NOTIFICATION_SLUG_PREFIX = /^(c\.|a\.|pc\.|admin\.)/;

export function humanizeSlug(slug: string): string {
  if (!slug) return slug;
  const stripped = slug
    .replace(NOTIFICATION_SLUG_PREFIX, "")
    .replace(/[._\-/]+/g, " ")
    .trim();
  if (!stripped) return slug;
  return stripped
    .split(/\s+/)
    .map((w) =>
      w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w,
    )
    .join(" ");
}
