import { AUDIENCE_DEMOGRAPHICS_CAPTURE } from "../../../constants/instagram/AUDIENCE_CAPTURE.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { fetchJSONWithAbort } from "../../core/http/fetchJSONWithAbort.js";

type AudienceBucket = {
  age: string;
  gender: string;
  value: number;
};

type AudienceGenderAgeResult = {
  sumValue: number; // sum of ALL IG buckets (even those not selected)
  buckets: AudienceBucket[]; // selected buckets until cap OR coverage reached
};

// Choose cap and coverage target from bands based on follower count
function chooseBandParams(followerCount: number) {
  const cfg = AUDIENCE_DEMOGRAPHICS_CAPTURE;
  const bands = cfg.followerBandCaps;

  let maxBuckets = bands[bands.length - 1].maxBuckets;
  let percentageOfTotal = bands[bands.length - 1].percentageOfTotal;

  for (const band of bands) {
    if (followerCount <= band.maxFollowers) {
      maxBuckets = band.maxBuckets;
      percentageOfTotal = band.percentageOfTotal;
      break;
    }
  }

  const minBuckets = Math.min(cfg.minBuckets ?? 0, maxBuckets);
  return { minBuckets, maxBuckets, percentageOfTotal };
}

/**
 * Fetch top audience gender/age buckets with coverage-based selection.
 * Similar to selectAndGeocodeAudienceLocations: keeps top buckets until cap OR coverage reached.
 * Returns both sumValue (total of all buckets) and selected buckets.
 * Throws 2004 on HTTP/network/shape errors.
 */
export const getAudienceGenderAgeFromIG = async (
  uid: string,
  token: string,
  opts?: { followerCount?: number }
): Promise<AudienceGenderAgeResult> => {
  if (!uid || !token) {
    throw createCustomError(2004, "Missing Instagram audience params", 502);
  }

  const followerCount = Number.isFinite(opts?.followerCount)
    ? Math.trunc(opts!.followerCount as number)
    : 0;

  const { minBuckets, maxBuckets, percentageOfTotal } =
    chooseBandParams(followerCount);

  const url = new URL(`https://graph.instagram.com/${uid}/insights`);
  url.searchParams.set("metric", "follower_demographics");
  url.searchParams.set("period", "lifetime");
  url.searchParams.set("breakdown", "age,gender");
  url.searchParams.set("metric_type", "total_value");
  url.searchParams.set("access_token", token);

  const responseJson = await fetchJSONWithAbort(
    url.toString(),
    15_000,
    2004,
    "Failed to get audience gender/age"
  );

  const data = Array.isArray(responseJson?.data) ? responseJson.data : [];
  const results =
    data.length > 0
      ? (responseJson.data[0]?.total_value?.breakdowns?.[0]?.results ?? [])
      : [];

  if (!Array.isArray(results) || results.length === 0) {
    return { sumValue: 0, buckets: [] };
  }

  // Sort by value desc
  const sorted = [...results].sort((a: any, b: any) => {
    const av = typeof a?.value === "number" ? a.value : Number(a?.value) || 0;
    const bv = typeof b?.value === "number" ? b.value : Number(b?.value) || 0;
    return bv - av;
  });

  // Compute total sumValue from ALL buckets
  let sumValue = 0;
  for (const r of sorted) {
    const v = typeof r?.value === "number" ? r.value : Number(r?.value) || 0;
    if (v > 0) sumValue += v;
  }
  if (sumValue <= 0) {
    return { sumValue: 0, buckets: [] };
  }

  // Select buckets until cap OR coverage reached
  const out: AudienceBucket[] = [];
  let covered = 0;

  for (const item of sorted) {
    if (!item) continue;

    const dims: any[] = Array.isArray(item?.dimension_values)
      ? item.dimension_values
      : [];
    const age = typeof dims[0] === "string" ? dims[0] : "";
    const gender = typeof dims[1] === "string" ? dims[1] : "";
    if (!age || !gender) continue;

    const valueNum =
      typeof item?.value === "number" ? item.value : Number(item?.value) || 0;
    if (valueNum <= 0) continue;

    out.push({
      age,
      gender,
      value: Math.trunc(valueNum),
    });
    covered += valueNum;

    // Stop if we've reached max buckets
    if (out.length >= maxBuckets) break;

    // After min buckets, check coverage
    if (out.length >= minBuckets) {
      const coverage = covered / sumValue;
      if (coverage >= percentageOfTotal) break;
    }
  }

  return { sumValue, buckets: out };
};
