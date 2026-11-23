import { calculateEstPrices, type EstRewardResult } from "./calculateEstPrice.js";
import { LOCAL_REWARD_ALGO_VERSION } from "../../constants/rewards/META.js";
import {
  getRewardEstGenerations,
  getAdvertiserBudgetGens,
  rewardEstKey,
  readRewardEstEntries,
  writeRewardEstEntries,
} from "./rewardEstCache.js";
import { getBusinessAdvertiserIds } from "../businesses/businessAccessibility.js";
import type { RewardMessageSlug } from "@tagly/models/shared";

// Wire form of EstRewardResult — bigints (price/reward/capacity) can't be
// JSON-encoded, so they're stored as decimal strings. The cache key carries an
// `s2` schema token (rewardEstKey) that MUST be bumped whenever this shape
// changes, so pre-deploy entries missing a field can never hydrate as undefined.
type SerializedEst = {
  price: string | null;
  reward: string | null;
  averageReach: number | null;
  messageSlugs: RewardMessageSlug[];
  isRewardCapped: boolean;
  capacityCents: string | null;
};

function serialize(r: EstRewardResult): string {
  const s: SerializedEst = {
    price: r.price === null ? null : r.price.toString(),
    reward: r.reward === null ? null : r.reward.toString(),
    averageReach: r.averageReach,
    messageSlugs: r.messageSlugs,
    isRewardCapped: r.isRewardCapped,
    capacityCents: r.capacityCents === null ? null : r.capacityCents.toString(),
  };
  return JSON.stringify(s);
}

function deserialize(raw: string): EstRewardResult | null {
  try {
    const s = JSON.parse(raw) as SerializedEst;
    return {
      price: s.price === null ? null : BigInt(s.price),
      reward: s.reward === null ? null : BigInt(s.reward),
      averageReach: s.averageReach,
      messageSlugs: s.messageSlugs,
      isRewardCapped: s.isRewardCapped,
      capacityCents:
        s.capacityCents === null ? null : BigInt(s.capacityCents),
    };
  } catch {
    // Corrupt/legacy entry — treat as a miss.
    return null;
  }
}

/**
 * Read-through cache over `calculateEstPrices` for the DISPLAY paths (Discover /
 * map / preview hydration). Same signature + return as `calculateEstPrices`, so it
 * drops straight into `hydrateBusinessPublicPreviews`. NOT used by share creation —
 * that always prices fresh (the estimate becomes the real reward basis).
 *
 * Fails open: ANY Redis error → price the whole batch fresh (pure passthrough), so
 * the cache can never change a result, only save queries.
 *
 * Every result shape is cacheable (E062): the no-IG story-views fallback is
 * SERVER-OWNED (`Customer.estimatedStoryViews`, written only by
 * updateEstimatedStoryViews, which bumps the customer generation), so an
 * estimate — including the `ESTIMATED_REACH`-priced and `NO_STORY_VIEWS`-null
 * shapes — is a pure function of server state and re-keys whenever any input
 * moves. There is deliberately NO per-request reach parameter anymore: a
 * request-supplied value can't participate in the key, which is exactly how
 * the original poisoning bug happened.
 */
export async function getEstPricesCached({
  customerId,
  localIds,
}: {
  customerId: number;
  localIds: number[];
}): Promise<Map<number, EstRewardResult>> {
  if (localIds.length === 0) return new Map();

  try {
    // Resolve each business's advertiser first — the advertiser budget generation
    // is part of the key (a budget/PAYG change invalidates that advertiser's
    // estimates via `applyBalancesFromEvent`/PAYG endpoints). A subsidized/no-
    // advertiser business uses the sentinel gen 0 (its estimate is never capped).
    const advertiserIdByBusiness = await getBusinessAdvertiserIds(localIds);
    const advertiserIds = [
      ...new Set(
        [...advertiserIdByBusiness.values()].filter(
          (id): id is number => id !== null,
        ),
      ),
    ];
    const [{ customerGen, businessGens }, advertiserGens] = await Promise.all([
      getRewardEstGenerations(customerId, localIds),
      getAdvertiserBudgetGens(advertiserIds),
    ]);
    const keyFor = (businessId: number): string => {
      const advertiserId = advertiserIdByBusiness.get(businessId) ?? null;
      return rewardEstKey({
        algoVersion: LOCAL_REWARD_ALGO_VERSION,
        customerId,
        customerGen,
        businessId,
        businessGen: businessGens.get(businessId) ?? 0,
        advertiserGen:
          advertiserId === null ? 0 : (advertiserGens.get(advertiserId) ?? 0),
      });
    };

    const raw = await readRewardEstEntries(localIds.map(keyFor));

    const hits = new Map<number, EstRewardResult>();
    const misses: number[] = [];
    localIds.forEach((id, i) => {
      const cell = raw[i];
      const hit = cell ? deserialize(cell) : null;
      if (hit) hits.set(id, hit);
      else misses.push(id);
    });

    const fresh =
      misses.length > 0
        ? await calculateEstPrices({ customerId, localIds: misses })
        : new Map<number, EstRewardResult>();

    if (misses.length > 0) {
      const writes: { key: string; value: string }[] = [];
      for (const id of misses) {
        const r = fresh.get(id);
        // Every shape is cacheable: all pricing inputs (incl. the server-owned
        // story-views fallback) are keyed via the generation counters (E062).
        if (r) {
          writes.push({ key: keyFor(id), value: serialize(r) });
        }
      }
      void writeRewardEstEntries(writes);
    }

    // Assemble the result in the SAME order as the input localIds, so this is a
    // byte-faithful drop-in for calculateEstPrices (whose Map is input-ordered) —
    // even though every current caller reads it by id lookup, not iteration.
    const result = new Map<number, EstRewardResult>();
    for (const id of localIds) {
      const v = hits.get(id) ?? fresh.get(id);
      if (v !== undefined) result.set(id, v);
    }
    return result;
  } catch {
    // Redis unavailable → passthrough.
    return calculateEstPrices({ customerId, localIds });
  }
}
