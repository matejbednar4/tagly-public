import { createCustomError } from "../../core/errors/createCustomError.js";
import { fetchJSONWithAbort } from "../../core/http/fetchJSONWithAbort.js";

export type AudienceCityBucket = {
  city: string;
  region?: string;
  value: number;
};

export type AudienceCityBreakdown = {
  sumValue: number; // sum of ALL IG buckets (even those never geocoded/stored)
  buckets: AudienceCityBucket[]; // sorted by value desc
};

/**
 * Fetches a raw audience city breakdown from the Instagram insights API —
 * no geocoding, no selection/capping (that's `selectAndGeocodeAudienceLocations`).
 *
 * `follower_demographics` is queried exactly as before (period=lifetime, no
 * timeframe). `reached_audience_demographics` requires a rolling `timeframe`
 * (`this_week` / `this_month`); IG SUPPRESSES the metric below ~100 reached
 * accounts in the window by returning an empty dataset — that surfaces here as
 * `{ sumValue: 0, buckets: [] }`, not an error.
 */
export async function fetchAudienceCityBreakdownFromIG({
  uid,
  token,
  metric,
  timeframe,
}: {
  uid: string;
  token: string;
  metric: "follower_demographics" | "reached_audience_demographics";
  timeframe?: "this_week" | "this_month";
}): Promise<AudienceCityBreakdown> {
  if (!uid || !token) {
    throw createCustomError(2005, "Missing Instagram audience city params", 502);
  }

  const url = new URL(`https://graph.instagram.com/${uid}/insights`);
  url.searchParams.set("metric", metric);
  url.searchParams.set("period", "lifetime");
  if (timeframe) url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("breakdown", "city");
  url.searchParams.set("metric_type", "total_value");
  url.searchParams.set("access_token", token);

  const responseJson = await fetchJSONWithAbort(
    url.toString(),
    15_000,
    2005,
    `Failed to get ${metric} city breakdown`
  );

  const data = Array.isArray(responseJson?.data) ? responseJson.data : [];
  const results =
    data.length > 0
      ? (responseJson.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [])
      : [];

  if (!Array.isArray(results) || results.length === 0) {
    return { sumValue: 0, buckets: [] };
  }

  const buckets: AudienceCityBucket[] = [];
  let sumValue = 0;

  for (const item of results) {
    const dims: unknown[] = Array.isArray(item?.dimension_values)
      ? item.dimension_values
      : [];
    const originalAddress = typeof dims[0] === "string" ? dims[0] : "";
    const value =
      typeof item?.value === "number" ? item.value : Number(item?.value) || 0;
    if (value <= 0) continue;

    sumValue += value;

    // Address parsing: "City, Region" (when present)
    const parts = originalAddress.split(",").map((p: string) => p.trim());
    const city = parts[0] || "";
    if (!city) continue;

    buckets.push({ city, region: parts[1] || undefined, value });
  }

  if (sumValue <= 0) {
    return { sumValue: 0, buckets: [] };
  }

  buckets.sort((a, b) => b.value - a.value);
  return { sumValue, buckets };
}
