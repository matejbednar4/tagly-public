import type { Address } from "@tagly/models/shared";
import {
  geocodeAddressOrThrow,
  type StrictGeocodedAddress,
} from "../../geo/geocodeAddressOrThrow.js";
import { geocodeAddressOrReturn } from "../../geo/geocodeAddressOrReturn.js";
import { getTimezoneForCoordinates } from "../../geo/getTimezoneForCoordinates.js";

export type GeocodedBusinessAddress = {
  /** Geocoder-normalized fields — the single source of truth to persist. */
  geocoded: StrictGeocodedAddress;
  lat: number;
  lon: number;
  /** City centroid for city-level search; falls back to the exact pin. */
  cityLat: number;
  cityLon: number;
  /** IANA timezone for the exact pin. */
  timezone: string;
};

/**
 * The full geocode a business address needs, in one call: strict geocode
 * (1203/1204/5200 on failure — full country/city/zip/street required), a
 * best-effort city centroid (a failed city lookup must never block the write),
 * and the timezone for the pin. Shared by create and update (and future
 * admin) so an edited address goes through exactly the same pipeline as a
 * created one.
 */
export async function geocodeBusinessAddressOrThrow(
  address: Address,
): Promise<GeocodedBusinessAddress> {
  const geocoded = await geocodeAddressOrThrow(address);
  const { lat, lon } = geocoded;

  const cityGeo = await geocodeAddressOrReturn({
    country: address.country,
    region: address.region,
    city: address.city,
  });
  const cityLat = typeof cityGeo === "number" ? lat : cityGeo.lat;
  const cityLon = typeof cityGeo === "number" ? lon : cityGeo.lon;

  return {
    geocoded,
    lat,
    lon,
    cityLat,
    cityLon,
    timezone: getTimezoneForCoordinates(lat, lon),
  };
}
