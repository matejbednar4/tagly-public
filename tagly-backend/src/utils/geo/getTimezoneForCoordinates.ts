import tzlookup from "tz-lookup";

/**
 * Resolve the IANA timezone (e.g. "America/New_York") for a geographic point.
 *
 * A pure geographic fact — invariant across API versions, exactly like
 * `getCountryForTimezone`. Every address write
 * path calls this to stamp `Address.timezone` from the geocoded lat/lon, which
 * then drives local-time features (e.g. a business's "open now" computation
 * from its opening-hours periods).
 *
 * Coordinates come from the geocoder and are always in range; tz-lookup
 * snaps to the nearest zone and only throws on out-of-range input.
 */
export const getTimezoneForCoordinates = (
  latitude: number,
  longitude: number
): string => tzlookup(latitude, longitude);
