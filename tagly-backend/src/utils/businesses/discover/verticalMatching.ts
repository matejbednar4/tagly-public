import {
  advertiserTypeBySlug,
  interestBySlug,
  type VerticalSlug,
} from "@tagly/models/shared";

/**
 * Pure catalog lookups shared by the Discover ranking endpoints
 * (`getRecommendedBusinesses`, `getMostPayingBusinesses`). They translate a
 * customer's taste signals (declared interests + verticals they've shared into)
 * to the business-type slugs used to pre-select / boost candidates in SQL.
 */

/** Union of the verticals a set of customer interest slugs belongs to. */
export function verticalsForInterests(
  interestSlugs: string[],
): Set<VerticalSlug> {
  const verticals = new Set<VerticalSlug>();
  for (const slug of interestSlugs) {
    const def = interestBySlug.get(slug);
    if (def) for (const v of def.verticalSlugs as VerticalSlug[]) verticals.add(v);
  }
  return verticals;
}

/**
 * Every advertiser-type slug whose vertical(s) intersect `verticals` — the set
 * of business types a customer with those verticals is interested in. Returns
 * `[]` for an empty vertical set (callers treat that as "no taste signal").
 */
export function typeSlugsForVerticals(verticals: Set<VerticalSlug>): string[] {
  if (verticals.size === 0) return [];
  const slugs: string[] = [];
  for (const type of advertiserTypeBySlug.values()) {
    if ((type.verticalSlugs as VerticalSlug[]).some((v) => verticals.has(v))) {
      slugs.push(type.slug);
    }
  }
  return slugs;
}
