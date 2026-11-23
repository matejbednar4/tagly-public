import {
  GEO_MULTIPLIER,
  NO_IG_GEO_BASE_BPS_BY_COUNTRY,
  NO_IG_GEO_BASE_DEFAULT_BPS,
} from "../../constants/rewards/multipliers/GEO.js";
import { REWARD_TAKES } from "../../constants/rewards/PRICING.js";
import prisma from "../../prisma/prisma.js";
import { bpsOfCents } from "../formatting/bpsOfCents.js";
import { createCustomError } from "../core/errors/createCustomError.js";
import {
  getBusinessSubsidizedStatuses,
  getBusinessBudgetCapacities,
  LOW_BUDGET_THRESHOLD_CENTS,
} from "../businesses/businessAccessibility.js";
import { getLatestSnapshot } from "../instagram/snapshots/getLatestSnapshot.js";
import { applyPriceCap } from "./helpers/applyPriceCap.js";
import { calculateCustomerRatingBps } from "./helpers/calculateCustomerRatingBps.js";
import { calculateDemographicsBps } from "./helpers/calculateDemographicsBps.js";
import {
  calculateFrequencyBps,
  fetchFrequencyData,
  type FrequencyData,
} from "./helpers/calculateFrequencyBps.js";
import { calculateInterestsBps } from "./helpers/calculateInterestsBps.js";
import { calculateTypeBps } from "./helpers/calculateTypeBps.js";
import { calculateAudienceRelevanceBps } from "./helpers/calculateAudienceRelevanceBps.js";
import { calculateAccountQualityBps } from "./helpers/calculateAccountQualityBps.js";
import { calculateGeographicsBps } from "./helpers/calculateGeographicsBps.js";
import { calculateEstBasePrice } from "./helpers/calculateEstBasePrice.js";
import { getCountryMultiplierBps } from "./helpers/getCountryMultiplierBps.js";
import type { RewardMessageSlug } from "@tagly/models/shared";
import type { AudienceLocationSource } from "../../generated/prisma/enums.js";

// Slugs of user-facing reward messages — the FE renders the bilingual label
// from @tagly/models/rewardMessagesCatalog.
export type EstRewardResult = {
  price: bigint | null;
  reward: bigint | null;
  // Reach the estimate was built on. Null only when we returned early without
  // computing a reward (e.g. NO_STORY_VIEWS).
  averageReach: number | null;
  messageSlugs: RewardMessageSlug[];
  // The reward/price was capped below the raw algo value because the business's
  // available budget is smaller than the estimated gross (credits-only path).
  // Never true for subsidized/PAYG (unlimited funding). Drives "up to" phrasing.
  isRewardCapped: boolean;
  // What the business's budget can fund right now, in USD cents — `null` when the
  // funding path is unlimited (subsidized / active PAYG). Drives the hot-deal /
  // low-budget scarcity flag (`isLowBudgetEstimate` below). `available`
  // (coalesced 0) otherwise, even when the estimate wasn't capped, so the flag
  // can compare it to the warning threshold.
  capacityCents: bigint | null;
};

/**
 * The customer-facing "ending soon" (hot-deal / `isLowBudget`) flag for a
 * business, derived from its reward estimate: the reward was budget-capped, OR
 * the remaining fundable capacity sits below the shared low-budget warning
 * threshold. `capacityCents` is null for subsidized/PAYG businesses (their
 * funding isn't capacity-bound), so the flag is never true for them — the same
 * PAYG exemption `isInLowBudgetWarningBand` encodes on the advertiser side,
 * and the same `LOW_BUDGET_THRESHOLD_CENTS` both rules read. This is the ONE
 * derivation of `isLowBudget` — hydrators/controllers must call it, never
 * recompose the comparison.
 */
export function isLowBudgetEstimate(
  est: EstRewardResult | undefined,
): boolean {
  if (!est) return false;
  return (
    est.isRewardCapped ||
    (est.capacityCents !== null &&
      est.capacityCents < LOW_BUDGET_THRESHOLD_CENTS)
  );
}

// Customer-level pricing inputs — everything that does NOT depend on which
// business is being priced, fetched once and reused for every business.
type LastSnapshot = {
  id: number;
  followerCount: number;
  followingCount: number | null;
  audienceLocationsSource: AudienceLocationSource | null;
  audienceGenderAges: { gender: string; age: string; value: number }[];
};
type CustomerForPricing = {
  interests: { slug: string }[];
  sensitiveData: { multiplierBps: number };
  instagram: { followerCount: number } | null;
};

// IMPORTANT: bump LOCAL_REWARD_ALGO_VERSION in constants/rewards/META.ts
// whenever the pricing logic in this file changes.

/**
 * Estimate the reward/price for one customer across one or more businesses.
 *
 * Batched: the customer-level inputs (IG token, latest snapshot, customer, base
 * reach/price) are fetched ONCE and reused for every business — only the
 * genuinely per-business work (the business row, geo, demographics, interests,
 * frequency, country/cap) runs per id. Pass a single id to price one business.
 *
 * `isSubsidized` is resolved internally per business via
 * `getBusinessSubsidizedStatuses`. Customer-level "can't price" states (no
 * snapshot, or no Instagram + no story-views estimate) apply uniformly to every
 * business. Returns a `Map` keyed by `localId`.
 */
export async function calculateEstPrices({
  customerId,
  localIds,
  postedToIgAt,
}: {
  customerId: number;
  localIds: number[];
  // When provided (share creation), the frequency window is anchored to the
  // Instagram post timestamp; when absent (preview hydration), falls back to now.
  postedToIgAt?: Date;
}): Promise<Map<number, EstRewardResult>> {
  if (localIds.length === 0) return new Map();

  const [
    hasValidToken,
    lastSnapshot,
    customer,
    subsidizedStatuses,
    budgetCapacities,
  ] = await Promise.all([
    prisma.instagramToken.findFirst({
      where: { instagram: { customerId }, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
    getLatestSnapshot(customerId, {
      id: true,
      followerCount: true,
      followingCount: true,
      audienceLocationsSource: true,
      audienceGenderAges: {
        select: { gender: true, age: true, value: true },
      },
    }),
    prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        interests: { select: { slug: true } },
        sensitiveData: { select: { multiplierBps: true } },
        instagram: { select: { followerCount: true } },
        estimatedStoryViews: true,
      },
    }),
    getBusinessSubsidizedStatuses(localIds),
    // Per-business budget capacity — caps a credits-only estimate at what the
    // budget can actually fund (subsidized/PAYG are exempted inside).
    getBusinessBudgetCapacities(localIds),
  ]);

  // The no-IG reach fallback is SERVER-OWNED (E062): read from the customer
  // row, never from a request param — that makes every estimate a pure
  // function of server state, so the reward-est cache is always valid (the
  // write path, updateEstimatedStoryViews, bumps the customer gen).
  const estimatedReach = customer?.estimatedStoryViews ?? undefined;

  // Customer-level "nothing to price on" — applies to every business uniformly.
  if (!lastSnapshot) {
    if (hasValidToken === null && estimatedReach == null) {
      // No snapshot, no valid token, no story views — nothing to base a reward on.
      return resultForAll(localIds, ["NO_STORY_VIEWS"]);
    }
    if (hasValidToken !== null) {
      // Valid token but no snapshot yet (account just connected; the IG snapshot
      // worker hasn't written one). Geo is the dominant multiplier and we have no
      // audience locations, so any estimate would be misleading — hard-return null
      // and let the client show the "rewards calculating" state. This existence
      // check (no `lastSnapshot`) is the same one `customerHasSnapshot` powers for
      // `CustomerMe.instagram.hasSnapshot`, so the estimate and the flag flip in
      // lockstep.
      return resultForAll(localIds, ["NO_SNAPSHOT"]);
    }
    // else: no token but story views provided — ESTIMATED_REACH slug comes from
    // usedEstimate inside priceOneBusiness.
  }

  if (!customer)
    throw createCustomError(
      5235,
      "customer not found when calculating est reward",
      500,
    );

  // Customer-level inputs fetched once and reused for every business: base reach/
  // price (estimatedReach is only used as a fallback when no IG exists), and the
  // rolling 24h/7d frequency windows (only the same-business 24h check is
  // per-business — a pure lookup against this data).
  // Follower baseline for the STORY reach cap on the recent-share samples —
  // prefer the snapshot's count (closest to when those shares happened), fall
  // back to the live IG count. Absent for customers without Instagram, in which
  // case calculateEstBasePrice skips capping.
  const followerCount =
    lastSnapshot?.followerCount ??
    customer.instagram?.followerCount ??
    undefined;

  const [base, frequency] = await Promise.all([
    calculateEstBasePrice({ customerId, estimatedReach, followerCount }),
    fetchFrequencyData({ customerId, since: postedToIgAt ?? new Date() }),
  ]);

  // Account-wide (not per-business): the follower:following quality penalty
  // depends only on the customer's snapshot, so compute it once. Neutral on the
  // no-IG estimate path (no follower/following data), like the other multipliers.
  const accountQuality =
    !base.usedEstimate && lastSnapshot
      ? calculateAccountQualityBps({
          followerCount: lastSnapshot.followerCount,
          followingCount: lastSnapshot.followingCount,
        })
      : {
          bps: 10_000,
          messageSlug: undefined as RewardMessageSlug | undefined,
        };

  const pairs = await Promise.all(
    localIds.map(async (localId) => {
      const capacity = budgetCapacities.get(localId);
      const est = await priceOneBusiness({
        localId,
        customerId,
        isSubsidized: subsidizedStatuses.get(localId) ?? false,
        availableBudgetUsdCents: capacity?.availableBudgetUsdCents ?? 0n,
        hasActivePaygPeriod: capacity?.hasActivePaygPeriod ?? false,
        postedToIgAt,
        lastSnapshot,
        customer,
        base,
        frequency,
        accountQualityBps: accountQuality.bps,
        accountQualityMessageSlug: accountQuality.messageSlug,
        followerCount,
      });
      return [localId, est] as const;
    }),
  );

  return new Map(pairs);
}

// Same result for every business — used for the customer-level early returns
// (no snapshot / no story views), which can't be priced regardless of business.
function resultForAll(
  localIds: number[],
  messageSlugs: RewardMessageSlug[],
): Map<number, EstRewardResult> {
  const m = new Map<number, EstRewardResult>();
  for (const id of localIds) {
    m.set(id, {
      price: null,
      reward: null,
      averageReach: null,
      messageSlugs: [...messageSlugs],
      isRewardCapped: false,
      capacityCents: null,
    });
  }
  return m;
}

// Prices a single business given the already-fetched customer-level inputs. The
// arithmetic here is unchanged from the original single-business pricer.
async function priceOneBusiness({
  localId,
  customerId,
  isSubsidized,
  availableBudgetUsdCents,
  hasActivePaygPeriod,
  postedToIgAt,
  lastSnapshot,
  customer,
  base,
  frequency,
  accountQualityBps,
  accountQualityMessageSlug,
  followerCount,
}: {
  localId: number;
  customerId: number;
  isSubsidized: boolean;
  // Business budget capacity for the credits-only cap (see below).
  availableBudgetUsdCents: bigint;
  hasActivePaygPeriod: boolean;
  postedToIgAt?: Date;
  lastSnapshot: LastSnapshot | null;
  customer: CustomerForPricing;
  base: { basePriceCents: bigint; averageReach: number; usedEstimate: boolean };
  frequency: FrequencyData;
  // Account-wide follower:following penalty, computed once by the caller.
  accountQualityBps: number;
  accountQualityMessageSlug?: RewardMessageSlug;
  // Snapshot (else live IG) follower count, computed once by the caller.
  // Undefined for customers with no Instagram at all.
  followerCount: number | undefined;
}): Promise<EstRewardResult> {
  const messageSlugs: RewardMessageSlug[] = [];

  const local = await prisma.localSubaccount.findUnique({
    where: { id: localId },
    select: {
      type: { select: { slug: true } },
      name: true,
      address: { select: { countryCode: true } },
    },
  });

  if (!local)
    throw createCustomError(
      5235,
      "local not found when calculating est reward",
      500,
    );

  const { basePriceCents, averageReach, usedEstimate } = base;

  if (usedEstimate) {
    messageSlugs.push("ESTIMATED_REACH");
  }

  // When using story views estimate: apply a country-specific baseline geo
  // multiplier (we have no location data, so we approximate "typical" local
  // reach per market — see NO_IG_GEO_BASE_BPS_BY_COUNTRY).
  // When using real data but geo is unavailable (no snapshot): apply noGeoBps penalty.
  let geoBps: number = usedEstimate
    ? (NO_IG_GEO_BASE_BPS_BY_COUNTRY[local.address.countryCode] ??
      NO_IG_GEO_BASE_DEFAULT_BPS)
    : GEO_MULTIPLIER.noGeoBps;
  if (!usedEstimate && lastSnapshot) {
    const { bps, messageSlug: geoSlug } = await calculateGeographicsBps({
      localId,
      snapshot: lastSnapshot,
    });
    geoBps = bps;
    if (geoSlug) messageSlugs.push(geoSlug);
  }

  let demoBps = 10_000;
  if (!usedEstimate && lastSnapshot) {
    demoBps = calculateDemographicsBps({
      local,
      audienceGenderAges: lastSnapshot.audienceGenderAges as {
        gender: "M" | "F" | "U";
        age: string;
        value: number;
      }[],
    });
  }

  const interestsBps = calculateInterestsBps({ customer, local });
  // Intrinsic business-type multiplier (cafe discount, sports-fitness boost, …) —
  // prices the category itself, unlike the interests/demo MATCH multipliers.
  const typeBps = calculateTypeBps(local.type.slug);
  const { bps: customerRatingBps, messageSlug: ratingSlug } =
    calculateCustomerRatingBps({
      customerMultiplierBps: customer.sensitiveData.multiplierBps,
    });
  if (ratingSlug) messageSlugs.push(ratingSlug);

  const { bps: frequencyBps, messageSlug: frequencySlug } =
    await calculateFrequencyBps({
      // `since` is ignored because prefetched data is supplied (already windowed
      // at fetch time); only the same-business check uses localId here.
      since: postedToIgAt ?? new Date(),
      customerId,
      localId,
      prefetched: frequency,
    });
  if (frequencySlug) messageSlugs.push(frequencySlug);

  // Account authenticity, keyed on FOLLOWER count — not on averageReach. Reach
  // is already paid for in basePriceCents; see the helper. Undefined only on
  // the no-IG manual-story-views path, where it returns a neutral 1.0x.
  const audienceRelevanceBps = calculateAudienceRelevanceBps({
    followerCount,
  });

  let subtotalCents = basePriceCents;
  subtotalCents = bpsOfCents(subtotalCents, geoBps);
  subtotalCents = bpsOfCents(subtotalCents, demoBps);
  subtotalCents = bpsOfCents(subtotalCents, interestsBps);
  subtotalCents = bpsOfCents(subtotalCents, typeBps);
  subtotalCents = bpsOfCents(subtotalCents, customerRatingBps);
  subtotalCents = bpsOfCents(subtotalCents, frequencyBps);
  subtotalCents = bpsOfCents(subtotalCents, audienceRelevanceBps);
  subtotalCents = bpsOfCents(subtotalCents, accountQualityBps);
  if (accountQualityMessageSlug) messageSlugs.push(accountQualityMessageSlug);

  const cappedCents = applyPriceCap(subtotalCents, isSubsidized);

  // For subsidized shares there is no platform take — both price and reward are
  // the capped amount × 60%. For regular shares the take is deducted from the
  // gross price to derive the customer reward.
  const usScalePriceCents = isSubsidized
    ? bpsOfCents(cappedCents, 10_000 - REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS)
    : cappedCents;

  const usScaleRewardCents = isSubsidized
    ? usScalePriceCents
    : bpsOfCents(
        usScalePriceCents,
        10_000 - REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS,
      );

  // Country-specific multiplier — the ECPM curve, action bonuses, and cap
  // are all defined in USD. For non-US locals (currently only CZ) we scale
  // both the price and the reward to local market pricing. Matches the
  // post-cap scaling in calculateFinalPrice so the estimated number the
  // customer sees lines up with what gets paid.
  const countryBps = getCountryMultiplierBps(local.address.countryCode);

  const estPriceCents = bpsOfCents(usScalePriceCents, countryBps);
  const estRewardCents = bpsOfCents(usScaleRewardCents, countryBps);

  // Budget capping — CREDITS-ONLY. Subsidized (platform-funded) and active-PAYG
  // (card-funded) businesses fund the full price, so they're never capped and
  // report `capacityCents = null` (unlimited). Checked FIRST: a subsidized
  // business has no sensitive-data row, so its `available` coalesced to 0, which
  // would otherwise zero the estimate.
  //
  // For a credits-only business the estimate is capped at `available` — the
  // gross that settlement can actually collect (partial lock + top-up both draw
  // on the same budget). The customer sees "up to {amount}" + a BUDGET_LIMITED
  // note. `capacityCents` is set even when uncapped so the hydrator can still
  // flag a low-but-sufficient budget.
  if (isSubsidized || hasActivePaygPeriod) {
    return {
      price: estPriceCents,
      reward: estRewardCents,
      averageReach,
      messageSlugs,
      isRewardCapped: false,
      capacityCents: null,
    };
  }

  // Capped ONLY when the budget actually reduces the number: available < the
  // estimated gross. In the band est ≤ available < 1.5×est the full lock isn't
  // affordable (the share funds as partial CREDITS) but the estimate itself is
  // fully fundable — flagging it "up to" would be wrong (the customer could
  // even earn slightly MORE than the shown value if the final outprices the
  // estimate within the budget). The low-capacity scarcity signal still fires
  // via `capacityCents` in the hydrator.
  if (availableBudgetUsdCents >= estPriceCents) {
    return {
      price: estPriceCents,
      reward: estRewardCents,
      averageReach,
      messageSlugs,
      isRewardCapped: false,
      capacityCents: availableBudgetUsdCents,
    };
  }

  // Partial-budget path: cap the gross to what's available and pay 60% of it.
  const cappedGrossCents = availableBudgetUsdCents;
  const cappedRewardCents = bpsOfCents(
    cappedGrossCents,
    10_000 - REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS,
  );
  messageSlugs.push("BUDGET_LIMITED");

  return {
    price: cappedGrossCents,
    reward: cappedRewardCents,
    averageReach,
    messageSlugs,
    isRewardCapped: true,
    capacityCents: availableBudgetUsdCents,
  };
}
