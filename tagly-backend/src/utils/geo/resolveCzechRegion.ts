import { CZECH_REGIONS } from "../../constants/localization/CZECH_REGIONS.js";

// Normalizes a region label for matching: strips diacritics, lowercases, drops
// the noise words "region"/"kraj", collapses everything non-letter to single
// spaces. So "Středočeský kraj", "Stredocesky", "Central Bohemian Region" and
// "Central Bohemia" all reduce to a comparable key.
function normalizeRegion(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(region|kraj)\b/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

// Precomputed lookup: normalized variant → canonical region name.
const CANONICAL_BY_NORMALIZED: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const { canonical, variants } of CZECH_REGIONS) {
    for (const v of variants) m.set(normalizeRegion(v), canonical);
  }
  return m;
})();

/**
 * If `region` is a recognizable Czech kraj (any of its English/Czech variants),
 * returns the canonical region name — the signal that this audience city is in
 * Czechia and must be geocoded with `countryCode: "CZ"`. Returns `undefined`
 * for anything else (every non-CZ market geocodes fine unconstrained).
 *
 * See `CZECH_REGIONS` for why this CZ-only special-case exists.
 */
export function resolveCzechRegion(region: string): string | undefined {
  const key = normalizeRegion(region);
  if (!key) return undefined;
  return CANONICAL_BY_NORMALIZED.get(key);
}
