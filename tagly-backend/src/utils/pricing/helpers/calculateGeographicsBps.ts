import { sql } from "kysely";
import { db } from "../../../db/kysely.js";
import { GEO_MULTIPLIER } from "../../../constants/rewards/multipliers/GEO.js";
import prisma from "../../../prisma/prisma.js";
import { geocodeAddressOrReturn } from "../../geo/geocodeAddressOrReturn.js";
import type { AudienceLocationSource } from "../../../generated/prisma/enums.js";
import {
  rewardMessageBySlug,
  type RewardMessageSlug,
} from "@tagly/models/shared";

type AudienceRow = {
  address: string;
  value: number;
  distanceKm: number;
};

/**
 * Geo: the share of this post's reach that counts as LOCAL, in bps (0..10_000).
 *
 * Since algo v12 this is a fraction, not a bonus — it answers "how many of
 * these views could plausibly walk in", by scoring the snapshot's CHOSEN
 * audience-location distribution against the business's city centroid on
 * GEO_MULTIPLIER.distanceCurve (1.0 same-city → 0 past ~85km) and taking the
 * value-weighted mean. Multiplying the base price by it is arithmetically the
 * same as multiplying reach by it, which is what the caller relies on: the
 * eCPM is the price of 1000 LOCAL views. It can never exceed 1.0 — the
 * near-audience premium lives in the eCPM, not here.
 *
 * The source was picked at capture time by the snapshot worker
 * (`snapshot.audienceLocationsSource`): REACHED_AUDIENCE (rolling this_month,
 * only when the `REACHED_AUDIENCE_CAPTURE` guards passed) or FOLLOWER_AUDIENCE.
 * Rows are priced exactly as reported: the stored rows are a capped top slice
 * of the full distribution, and the unseen tail is assumed to be distributed
 * like the seen rows — which leaves the value-weighted mean unchanged, so no
 * redistribution/top-up is applied to either source.
 */
export async function calculateGeographicsBps({
  localId,
  snapshot,
}: {
  localId: number;
  snapshot: {
    id: number;
    audienceLocationsSource: AudienceLocationSource | null;
  };
}): Promise<{ bps: number; messageSlug?: RewardMessageSlug }> {
  // 0) NULL source = the snapshot captured no audience locations at all
  // (e.g. <100 followers) — nothing to distance-tier.
  if (snapshot.audienceLocationsSource === null) {
    return { bps: GEO_MULTIPLIER.noGeoBps };
  }

  // 1) Business address

  const local = await prisma.localSubaccount.findUnique({
    where: { id: localId },
    select: {
      address: { select: { country: true, region: true, city: true } },
    },
  });
  const addr = local?.address;
  if (!addr) {
    return { bps: GEO_MULTIPLIER.noGeoBps };
  }

  // 2) Presence of storefront point & city centroid
  const geom = await db
    .selectFrom("app.local_subaccounts as l")
    .innerJoin("app.addresses as a", "a.id", "l.address_id")
    .select([
      sql<boolean>`a."location" IS NOT NULL`.as("has_location"),
      sql<boolean>`a."city_location" IS NOT NULL`.as("has_city_location"),
    ])
    .where("l.id", "=", localId)
    .executeTakeFirst();

  if (!geom?.has_location) {
    return { bps: GEO_MULTIPLIER.noGeoBps };
  }

  // 3) Ensure city centroid (write only if NULL)
  if (!geom.has_city_location) {
    const geo = await geocodeAddressOrReturn({
      country: addr.country,
      region: addr.region ?? undefined,
      city: addr.city,
    });

    if (typeof geo !== "number") {
      await sql`
        UPDATE "app"."addresses" a
        SET "city_location" = ST_SetSRID(ST_MakePoint(${geo.lon}, ${geo.lat}), 4326)::GEOGRAPHY
        WHERE a.id = (
          SELECT addr.id
          FROM "app"."local_subaccounts" l
          JOIN "app"."addresses" addr ON addr.id = l."address_id"
          WHERE l.id = ${localId}
          LIMIT 1
        )
        AND a."city_location" IS NULL
      `.execute(db);
    } else {
      // geocoder failed → fall back silently, no message shown to user
      return {
        bps: GEO_MULTIPLIER.noGeoBps,
      };
    }
  }

  // 4) Audience rows of the chosen source — distances from city centroid
  const audience = (await db
    .selectFrom("app.local_subaccounts as l")
    .innerJoin("app.addresses as a", "a.id", "l.address_id")
    .innerJoin("app.instagram_audience_location as ial", (join) =>
      join
        .on(sql`ial."snapshot_id" = ${snapshot.id}`)
        .on(
          sql`ial."source" = ${snapshot.audienceLocationsSource}::"app"."AudienceLocationSource"`
        )
    )
    .select([
      sql<string>`ial."address"`.as("address"),
      sql<number>`COALESCE(ial."value", 0)`.as("value"),
      sql<number>`ST_Distance(a."city_location"::GEOGRAPHY, ial."location"::GEOGRAPHY) / 1000.0`.as(
        "distanceKm"
      ),
    ])
    .where("l.id", "=", localId)
    .execute()) as AudienceRow[];

  if (!audience.length) {
    return { bps: GEO_MULTIPLIER.noGeoBps };
  }

  // Linear interpolation along GEO_MULTIPLIER.distanceCurve — continuous, so
  // there are no tier cliffs (24km and 26km price almost identically). Clamp to
  // the endpoints outside the anchor range (an infinite distance falls at/past
  // the last anchor → its value, which is 0: those views are free).
  function multForDistance(km: number): number {
    const curve = GEO_MULTIPLIER.distanceCurve;
    const first = curve[0]!;
    const last = curve.at(-1)!;
    if (km <= first.km) return first.multiplier;
    if (km >= last.km) return last.multiplier;
    for (let i = 1; i < curve.length; i++) {
      const hi = curve[i]!;
      if (km <= hi.km) {
        const lo = curve[i - 1]!;
        const t = (km - lo.km) / (hi.km - lo.km);
        return lo.multiplier + t * (hi.multiplier - lo.multiplier);
      }
    }
    return last.multiplier;
  }

  const rows = audience;

  let weighted = 0;
  let sumWeights = 0;

  if (GEO_MULTIPLIER.normalizeWeights) {
    const denom = rows.reduce((acc, r) => acc + Math.max(0, r.value), 0);
    if (denom === 0) {
      return { bps: GEO_MULTIPLIER.noGeoBps };
    }

    for (const r of rows) {
      const w = Math.max(0, r.value) / denom;
      const d = Number.isFinite(r.distanceKm)
        ? r.distanceKm
        : Number.POSITIVE_INFINITY;
      let m = multForDistance(d);
      weighted += w * m;
      sumWeights += w;
    }
  } else {
    for (const r of rows) {
      const w = Math.max(0, r.value);
      if (w === 0) continue;
      const m = multForDistance(r.distanceKm);
      weighted += w * m;
      sumWeights += w;
    }
    if (sumWeights === 0) {
      return { bps: GEO_MULTIPLIER.noGeoBps };
    }
  }

  const mult = weighted / sumWeights;
  const rawBps = Math.round(mult * 10_000);

  const minBps = Number(GEO_MULTIPLIER.minBps);
  const maxBps = Number(GEO_MULTIPLIER.maxBps);
  const clampedBps = Math.max(minBps, Math.min(maxBps, rawBps));

  let messageSlug: RewardMessageSlug | undefined = undefined;
  const threshold = rewardMessageBySlug.get("GEO_TOO_FAR")?.threshold;
  if (threshold !== undefined && clampedBps < threshold) {
    messageSlug = "GEO_TOO_FAR";
  }

  return { bps: clampedBps, messageSlug };
}
