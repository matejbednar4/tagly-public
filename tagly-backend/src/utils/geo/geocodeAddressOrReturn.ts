import { GeocodeCommand } from "@aws-sdk/client-geo-places";
import { geoPlacesClient } from "../clients/aws/geoPlaces.js";
import { reportError } from "../core/errors/reportError.js";

export type AddressInput = {
  country?: string;
  countryCode?: string; // ISO2 — used as a search filter (IncludeCountries)
  city?: string;
  zip?: string;
  street?: string;
  region?: string | null; // maps to Amazon Location's Region
};

/**
 * Loose result from Amazon Location Service (Places / Geocode). lat/lon are the
 * only guaranteed fields — every normalized address component is best-effort and
 * may be null. Callers that need a fully-populated address (e.g. subaccount
 * creation) must validate the fields they care about, or use geocodeAddressOrThrow
 * which enforces the full set.
 */
export type GeocodedAddress = {
  lat: number;
  lon: number;
  country: string | null;
  countryCode: string | null; // ISO alpha-2, uppercase
  region: string | null;
  city: string | null;
  zip: string | null;
  street: string | null;
};

// Attempts to geocode via Amazon Location. Success => GeocodedAddress (lat/lon
// guaranteed, everything else best-effort). Failure => numeric HTTP-ish status
// (404 no result, 400 on error) so callers keep their existing contract.
//
// IntendedUse MUST be "Storage": we persist the returned coordinates + normalized
// address into app.addresses / app.instagram_audience_location, so the terms of
// service require the (higher-priced) storage tier. Auth is IAM (see geoPlacesClient).
export const geocodeAddressOrReturn = async (
  raw: AddressInput
): Promise<GeocodedAddress | number> => {
  const clean = (v: string | null | undefined): string | undefined =>
    v && v.trim() ? v.trim() : undefined;

  const countryCode = clean(raw.countryCode);
  const city = clean(raw.city);
  const zip = clean(raw.zip);
  const street = clean(raw.street);
  const region = clean(raw.region);

  // Structured query — set only the components we actually have.
  const queryComponents: NonNullable<
    ConstructorParameters<typeof GeocodeCommand>[0]
  >["QueryComponents"] = {};
  if (street) queryComponents.Street = street;
  if (city) queryComponents.Locality = city;
  if (region) queryComponents.Region = region;
  if (zip) queryComponents.PostalCode = zip;

  try {
    const res = await geoPlacesClient.send(
      new GeocodeCommand({
        QueryComponents: queryComponents,
        // Restrict to the requested country (ISO alpha-2/3) when provided.
        ...(countryCode
          ? { Filter: { IncludeCountries: [countryCode] } }
          : {}),
        IntendedUse: "Storage",
        MaxResults: 1,
      })
    );

    const best = res.ResultItems?.[0];
    // Position is [longitude, latitude] in WGS 84.
    const lon = best?.Position?.[0];
    const lat = best?.Position?.[1];
    if (typeof lat !== "number" || Number.isNaN(lat)) return 404;
    if (typeof lon !== "number" || Number.isNaN(lon)) return 404;

    const addr = best?.Address ?? {};

    const pickString = (v: unknown): string | null =>
      typeof v === "string" && v.trim() !== "" ? v : null;

    const countryCodeOut = pickString(addr.Country?.Code2);
    const normalizedCountryCode = countryCodeOut
      ? countryCodeOut.toUpperCase()
      : null;

    // Locality is the city; fall through to District / SubRegion WITHIN Amazon
    // Location's own response only, never to user input.
    const cityOut =
      pickString(addr.Locality) ??
      pickString(addr.District) ??
      pickString(addr.SubRegion?.Name);

    // Reconstruct "401 Channelside Dr" from AddressNumber + Street when present.
    const addressNumber = pickString(addr.AddressNumber);
    const road = pickString(addr.Street);
    const streetOut = road
      ? addressNumber
        ? `${addressNumber} ${road}`
        : road
      : null;

    return {
      lat,
      lon,
      country: pickString(addr.Country?.Name),
      countryCode: normalizedCountryCode,
      region: pickString(addr.Region?.Name),
      city: cityOut,
      zip: pickString(addr.PostalCode),
      street: streetOut,
    };
  } catch (err) {
    // A swallowed upstream failure is indistinguishable from a bad address at
    // the call sites (they all map 400 → "Failed to get coordinates"), so
    // record the REAL cause — throttling / network / credentials / a genuine
    // ValidationException — before collapsing to the numeric contract.
    const e = err as Error;
    const query = { ...queryComponents, countryFilter: countryCode ?? null };
    reportError(err, {
      source: "system",
      errorClass: "transient",
      service: "geocoding",
      error_name: e?.name,
      query,
    });
    return 400;
  }
};
