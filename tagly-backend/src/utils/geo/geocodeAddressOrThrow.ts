import { createCustomError } from "../core/errors/createCustomError.js";
import {
  geocodeAddressOrReturn,
  type AddressInput,
  type GeocodedAddress,
} from "./geocodeAddressOrReturn.js";

export type Coords = { lat: number; lon: number };

/**
 * Strictly-validated geocode for flows that need a full address (e.g. local
 * subaccount creation). On top of geocodeAddressOrReturn, this requires
 * the geocoder to have given us country, countryCode, city, zip, and street.
 * region stays nullable because not all countries have a meaningful state.
 */
export type StrictGeocodedAddress = GeocodedAddress & {
  country: string;
  countryCode: string;
  city: string;
  zip: string;
  street: string;
};

export const geocodeAddressOrThrow = async (
  raw: AddressInput
): Promise<StrictGeocodedAddress> => {
  const result = await geocodeAddressOrReturn(raw);

  if (typeof result === "number") {
    if (result === 404) {
      throw createCustomError(1203, "Address not found", 404);
    }
    if (result === 400) {
      throw createCustomError(
        1204,
        "Failed to get coordinates for the provided address",
        400
      );
    }
    throw createCustomError(
      5200,
      `Upstream geocoding error (HTTP ${result})`,
      502
    );
  }

  // Require the full address set. Missing any of these means the geocode is
  // too imprecise for subaccount creation — refuse rather than persist an
  // address we can't trust for future currency/region/display use.
  if (
    !result.country ||
    !result.countryCode ||
    !result.city ||
    !result.zip ||
    !result.street
  ) {
    throw createCustomError(1203, "Address not found", 404);
  }

  return result as StrictGeocodedAddress;
};
