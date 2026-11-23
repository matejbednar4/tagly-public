import { geocodeAddressOrReturn } from "../../../geo/geocodeAddressOrReturn.js";
import { resolveCzechRegion } from "../../../geo/resolveCzechRegion.js";

// Per-job geocode memo: normalized "city|region" → result. Negative results
// (nulls) are memoized too, so a city that failed every attempt isn't
// re-attempted for another audience source in the same job.
export type GeocodeMemo = Map<string, { lon: number | null; lat: number | null }>;

// Best-effort geocoding of one IG audience city. Never throws.
//
// IG gives us only "city, region" per bucket — no country. Almost everywhere
// that geocodes fine unconstrained (Amazon resolves "Tampa, Florida",
// "Tokyo, Tokyo", "Prague, Prague" correctly). The ONE market it breaks on is
// Czechia: Czech kraje are barely used colloquially, so IG's English region
// exonyms ("Central Bohemian Region", "South Moravian Region") send Amazon to
// the wrong country entirely (Kladno → Denmark, Brno → Sweden). So when the
// region resolves to a known Czech kraj we pin the geocode to `countryCode:
// "CZ"` (+ canonical region); every other city stays unconstrained.
//
// The returned `address` is always the original IG-provided "city, region"
// string — the CZ pin is a search filter only, never appended to the stored
// label. (No inter-call delay: Amazon Location handles throttling via SDK
// backoff, so audience geocoding no longer has to self-pace.)
export async function geocodeAudienceLocation({
  city,
  region,
  memo,
}: {
  city: string;
  region?: string;
  memo?: GeocodeMemo;
}): Promise<{ address: string; lon: number | null; lat: number | null }> {
  const address = region ? `${city}, ${region}` : city;

  const memoKey = `${city.toLowerCase()}|${(region ?? "").toLowerCase()}`;
  const memoized = memo?.get(memoKey);
  if (memoized) {
    return { address, lon: memoized.lon, lat: memoized.lat };
  }

  const done = (lon: number | null, lat: number | null) => {
    memo?.set(memoKey, { lon, lat });
    return { address, lon, lat };
  };

  // Czech city (region matches a known kraj): pin to CZ so the exonym can't
  // drag it across the border. Canonical region first; city + CZ as the
  // guaranteed fallback if Amazon doesn't recognize the region string.
  const czRegion = region ? resolveCzechRegion(region) : undefined;
  if (czRegion) {
    let geo = await geocodeAddressOrReturn({
      city,
      region: czRegion,
      countryCode: "CZ",
    });
    if (typeof geo !== "number") {
      return done(geo.lon, geo.lat);
    }
    geo = await geocodeAddressOrReturn({ city, countryCode: "CZ" });
    if (typeof geo !== "number") {
      return done(geo.lon, geo.lat);
    }
    return done(null, null);
  }

  // Everywhere else: geocode unconstrained (city + region, then city alone).
  let geo = await geocodeAddressOrReturn({ city, region });
  if (typeof geo !== "number") {
    return done(geo.lon, geo.lat);
  }
  geo = await geocodeAddressOrReturn({ city });
  if (typeof geo !== "number") {
    return done(geo.lon, geo.lat);
  }

  return done(null, null);
}
