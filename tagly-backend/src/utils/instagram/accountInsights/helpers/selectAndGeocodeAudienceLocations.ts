import {
  geocodeAudienceLocation,
  type GeocodeMemo,
} from "./geocodeAudienceLocations.js";
import { AUDIENCE_LOCATION_CAPTURE } from "../../../../constants/instagram/AUDIENCE_CAPTURE.js";
import type { AudienceCityBucket } from "../fetchAudienceCityBreakdownFromIG.js";

export type AudienceLocationRow = {
  address: string;
  lon: number;
  lat: number;
  value: number;
};

// Choose cap and coverage target from bands
function chooseBandParams(audienceSize: number) {
  const cfg = AUDIENCE_LOCATION_CAPTURE;
  const bands = cfg.followerBandCaps;

  let maxLocations = bands[bands.length - 1].maxLocations;
  let percentageOfTotal = bands[bands.length - 1].percentageOfTotal;

  for (const band of bands) {
    if (audienceSize <= band.maxFollowers) {
      maxLocations = band.maxLocations;
      percentageOfTotal = band.percentageOfTotal;
      break;
    }
  }

  const minLocations = Math.min(cfg.minLocations ?? 0, maxLocations);
  return { minLocations, maxLocations, percentageOfTotal };
}

/**
 * Selects + geocodes the top city buckets of an audience breakdown until the
 * band cap OR the coverage target is reached (bands in
 * `AUDIENCE_LOCATION_CAPTURE`, banded by `audienceSize`).
 *
 * `audienceSize` keys the band table: pass the follower count for a
 * follower-demographics breakdown, and the breakdown's own `sumValue` for a
 * reached-audience one (reach in the window — not follower count — is the size
 * of the distribution being sampled there).
 *
 * Pass one shared `memo` per snapshot job so overlapping cities across sources
 * (follower vs reached lists overlap heavily) geocode only once.
 */

export async function selectAndGeocodeAudienceLocations({
  buckets,
  sumValue,
  audienceSize,
  memo,
}: {
  buckets: AudienceCityBucket[]; // sorted by value desc
  sumValue: number;
  audienceSize: number;
  memo?: GeocodeMemo;
}): Promise<AudienceLocationRow[]> {
  if (sumValue <= 0 || buckets.length === 0) return [];

  const { minLocations, maxLocations, percentageOfTotal } = chooseBandParams(
    Number.isFinite(audienceSize) ? Math.trunc(audienceSize) : 0,
  );

  const out: AudienceLocationRow[] = [];
  let covered = 0;

  // Iterate all buckets in order, stop at cap or coverage
  for (const bucket of buckets) {
    const geo = await geocodeAudienceLocation({
      city: bucket.city,
      region: bucket.region,
      memo,
    });
    if (geo.lon === null || geo.lat === null) continue;

    out.push({
      address: geo.address,
      lon: geo.lon,
      lat: geo.lat,
      value: Math.trunc(bucket.value),
    });
    covered += bucket.value;

    if (out.length >= maxLocations) break;

    if (out.length >= minLocations) {
      const coverage = covered / sumValue;
      if (coverage >= percentageOfTotal) break;
    }
  }

  return out;
}
