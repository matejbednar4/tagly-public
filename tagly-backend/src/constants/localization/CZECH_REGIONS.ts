/**
 * Czech regions (kraje) — variant labels → the canonical region name we hand to
 * Amazon Location, used to pin an audience city to Czechia.
 *
 * WHY THIS EXISTS: Instagram reports each audience city as "City, Region" with
 * no country, and its Czech region labels are English exonyms ("Central
 * Bohemian Region", "South Moravian Region"). Czech kraje are barely used
 * colloquially, so an UNCONSTRAINED geocode of such a string lets Amazon resolve
 * the city into the wrong country entirely (Kladno → Denmark, Brno → Sweden).
 * When a city's region matches one of these, we know the city is in CZ, so we
 * geocode it with `countryCode: "CZ"` + the canonical region — the city can no
 * longer escape the border. Every other market's regions geocode fine
 * unconstrained, so this map is deliberately CZ-only (extend per market if the
 * same exonym problem ever appears elsewhere).
 *
 * `variants` are matched after normalization (lowercased, diacritics stripped,
 * the words "region"/"kraj" removed, non-letters collapsed) — see
 * `resolveCzechRegion`. So "Středočeský kraj", "Stredocesky", "Central Bohemian
 * Region" and "Central Bohemia" all collapse to the same entry.
 */
export const CZECH_REGIONS: { canonical: string; variants: string[] }[] = [
  {
    canonical: "Hlavní město Praha",
    variants: ["Prague", "Praha", "Hlavní město Praha", "Capital City of Prague"],
  },
  {
    canonical: "Středočeský kraj",
    variants: ["Central Bohemian", "Central Bohemia", "Středočeský"],
  },
  {
    canonical: "Jihočeský kraj",
    variants: ["South Bohemian", "South Bohemia", "Jihočeský"],
  },
  {
    canonical: "Plzeňský kraj",
    variants: ["Plzeň", "Pilsen", "Plzeňský"],
  },
  {
    canonical: "Karlovarský kraj",
    variants: ["Karlovy Vary", "Karlovarský"],
  },
  {
    canonical: "Ústecký kraj",
    variants: ["Ústí nad Labem", "Ústecký", "Usti nad Labem"],
  },
  {
    canonical: "Liberecký kraj",
    variants: ["Liberec", "Liberecký"],
  },
  {
    canonical: "Královéhradecký kraj",
    variants: ["Hradec Králové", "Královéhradecký"],
  },
  {
    canonical: "Pardubický kraj",
    variants: ["Pardubice", "Pardubický"],
  },
  {
    canonical: "Kraj Vysočina",
    variants: ["Vysočina", "Highlands"],
  },
  {
    canonical: "Jihomoravský kraj",
    variants: ["South Moravian", "South Moravia", "Jihomoravský"],
  },
  {
    canonical: "Olomoucký kraj",
    variants: ["Olomouc", "Olomoucký"],
  },
  {
    canonical: "Zlínský kraj",
    variants: ["Zlín", "Zlínský"],
  },
  {
    canonical: "Moravskoslezský kraj",
    variants: ["Moravian-Silesian", "Moravia-Silesia", "Moravskoslezský"],
  },
] as const;
