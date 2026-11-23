import type { Region } from "react-native-maps";
import type { SupportedLocale } from "@tagly/models/shared";

/**
 * Default map regions per home market — used for both the initial map camera and
 * the controls' "Center at <city>" jump. Extracted here so `BusinessMap` and
 * `MapControls` share one source of truth. (latitudeDelta is tuned per city: a
 * tight downtown view for Tampa, slightly wider for Prague.)
 */
export const TAMPA_DOWNTOWN: Region = {
  latitude: 27.9506,
  longitude: -82.4572,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export const PRAHA: Region = {
  latitude: 50.0755,
  longitude: 14.4378,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

/**
 * The default map region for a customer's home market: US → Tampa, everything
 * else — CZ AND unset/unknown — → Prague. Prague is the deliberate
 * no-location-no-locale fallback (decision 2026-08-14): most of the user base
 * is CZ, so an unresolved locale (customer still loading, pending accounts)
 * should open on Prague, not Tampa.
 */
export function getMarketRegion(locale?: SupportedLocale): Region {
  return locale === "US" ? TAMPA_DOWNTOWN : PRAHA;
}
