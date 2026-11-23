import prisma from "../../../prisma/prisma.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { validateLocaleIsSupportedOrThrow } from "../../localization/validateLocaleIsSupportedOrThrow.js";

/**
 * Enforce the advertiser-locale ↔ business-country invariant: an advertiser
 * can never own a business outside their own country (CZ locale → CZ, else US).
 * Shared by every business write path that sets or re-geocodes an address
 * (create init/confirm, update, future admin). 244 when the advertiser row is
 * missing, 4944 on a country mismatch.
 */
export async function assertBusinessCountryMatchesAdvertiserLocaleOrThrow({
  advertiserId,
  countryCode,
}: {
  advertiserId: number;
  /** The geocoder-normalized country code of the business address. */
  countryCode: string;
}): Promise<void> {
  const advertiserForLocale = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { locale: true },
  });
  if (!advertiserForLocale) {
    throw createCustomError(244, "Advertiser not found", 404);
  }
  const advertiserLocale = validateLocaleIsSupportedOrThrow(
    advertiserForLocale.locale,
  );
  const expectedCountryCode = advertiserLocale === "CZ" ? "CZ" : "US";
  if (countryCode.toUpperCase() !== expectedCountryCode) {
    throw createCustomError(
      4944,
      "Advertiser locale does not match business country",
      409,
    );
  }
}
