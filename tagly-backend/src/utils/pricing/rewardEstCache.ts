import { redis } from "../clients/redis.js";

// Redis read-through cache for reward ESTIMATES (Discover/map/preview display).
// This module owns the keys, the generation counters, and the raw MGET/SET — but
// knows nothing about the pricing value shape (the read-through in
// getEstPricesCached.ts serializes EstRewardResult ↔ JSON and passes opaque
// strings here). It imports only the Redis client, so any bump caller — the v2
// controllers, the igSnapshot worker, and the permanent ledger balance writer —
// can invalidate a generation without pulling in the pricer. It lives in
// next to the ledger because `applyBalancesFromEvent` — the ledger
// util called by controllers + workers + webhooks — is the advertiser-gen bump's main
// writer.
//
// Invalidation — THREE generation counters, all embedded in every key:
//   • per-CUSTOMER (`reward:gen:c:{id}`) — bump on a customer-level input change
//     (new snapshot, new share, IG state change). One INCR orphans all of that
//     customer's estimates at once.
//   • per-BUSINESS (`reward:gen:b:{id}`) — bump on a business-level input change
//     (relocation, type, subsidization start/stop) so ONE business's estimates are
//     invalidated across EVERY customer, again without SCAN. Four writers call it:
//     `utils/businesses/write/updateBusinessCore` (edits/relocation),
//     `v2/advertiserApp/businesses/deleteBusiness`,
//     `v2/adminApp/businesses/setBusinessAdvertiser` and `.../setBusinessSubsidized`.
//     (This comment previously said "no writer calls this yet"; that was true
//     before the v2 business endpoints landed and is no longer — business-side
//     changes invalidate immediately and do NOT ride the entry TTL.)
//   • per-ADVERTISER (`reward:gen:a:{id}`) — bump on a budget/PAYG change that
//     moves what the advertiser can fund (so capping flips). `applyBalancesFromEvent`
//     bumps it on every ledger money movement (purchases, refunds, locks/unlocks,
//     settles, PAYG charges); PAYG-active flips (card setup/removal/reconcile) bump
//     it explicitly since they don't ride a ledger event.
// Any INCR invalidates the matching slice; orphaned keys age out via TTL.
//
// Everything here FAILS OPEN: the caller treats any thrown error as a cache miss
// and prices fresh, and writes are best-effort. A Redis problem only costs the
// batch-pricing query savings, never correctness or availability.

// Backstop: how long a cached estimate lives absent an explicit generation bump.
// Bounds staleness for inputs nothing bumps on yet (per-business relocation /
// subsidization) and rolling-frequency decay on an otherwise-idle customer.
const ENTRY_TTL_SECONDS = 24 * 60 * 60; // 24h
// Generation counters outlive their entries so a counter never resets while any
// entry keyed to it is still readable; they expire only after full idleness.
const GENERATION_TTL_SECONDS = 35 * 24 * 60 * 60; // 35d

const customerGenKey = (customerId: number) => `reward:gen:c:${customerId}`;
const businessGenKey = (businessId: number) => `reward:gen:b:${businessId}`;
const advertiserGenKey = (advertiserId: number) => `reward:gen:a:${advertiserId}`;

const toGen = (v: string | null): number => (v ? parseInt(v, 10) || 0 : 0);

/**
 * Cache key for one (customer, business) estimate at the current customer,
 * business, AND advertiser generations. The v2 `LOCAL_REWARD_ALGO_VERSION` is
 * included so a pricing-algo deploy (which bumps that version) auto-invalidates
 * every entry.
 *
 * The `s2` schema token guards the VALUE shape (not the algo): it was bumped when
 * the cached estimate gained `isRewardCapped` + `capacityCents`, so pre-deploy
 * entries (which lack those fields) can't collide with the new key and hydrate
 * with `undefined`. Bump it again on any future SerializedEst shape change.
 */
export function rewardEstKey(a: {
  algoVersion: string;
  customerId: number;
  customerGen: number;
  businessId: number;
  businessGen: number;
  advertiserGen: number;
}): string {
  return `reward:est:s2:v${a.algoVersion}:c${a.customerId}:${a.customerGen}:b${a.businessId}:${a.businessGen}:a${a.advertiserGen}`;
}

async function bumpGen(key: string): Promise<void> {
  try {
    await redis.multi().incr(key).expire(key, GENERATION_TTL_SECONDS).exec();
  } catch {
    // best-effort; entries age out via TTL
  }
}

/** Invalidate ALL cached reward estimates for one customer (new snapshot / share /
 * IG state change). Fail-open. */
export async function bumpCustomerRewardEstGen(customerId: number): Promise<void> {
  await bumpGen(customerGenKey(customerId));
}

/** Invalidate one business's cached estimates across EVERY customer (relocation /
 * type / subsidization change). Fail-open. No caller yet — ready for the v2
 * business-edit + admin-subsidization endpoints. */
export async function bumpBusinessRewardEstGen(businessId: number): Promise<void> {
  await bumpGen(businessGenKey(businessId));
}

/** Invalidate every cached estimate priced against one advertiser's budget — its
 * budget or PAYG-active state changed, which can flip whether estimates are
 * capped. Fail-open. Called by `applyBalancesFromEvent` (every ledger money
 * movement) + the PAYG card endpoints (state flips without a ledger event). */
export async function bumpAdvertiserBudgetGen(advertiserId: number): Promise<void> {
  await bumpGen(advertiserGenKey(advertiserId));
}

/** Fetch the customer generation and every business generation in one round trip.
 * Missing counters read as 0. Throws on a Redis error so the caller fails open. */
export async function getRewardEstGenerations(
  customerId: number,
  businessIds: number[],
): Promise<{ customerGen: number; businessGens: Map<number, number> }> {
  const keys = [customerGenKey(customerId), ...businessIds.map(businessGenKey)];
  const vals = await redis.mget(keys);
  const customerGen = toGen(vals[0] ?? null);
  const businessGens = new Map<number, number>(
    businessIds.map((id, i) => [id, toGen(vals[i + 1] ?? null)]),
  );
  return { customerGen, businessGens };
}

/** Fetch the budget generation for a batch of advertiser ids in one round trip.
 * Missing counters read as 0. Throws on a Redis error so the caller fails open. */
export async function getAdvertiserBudgetGens(
  advertiserIds: number[],
): Promise<Map<number, number>> {
  if (advertiserIds.length === 0) return new Map();
  const vals = await redis.mget(advertiserIds.map(advertiserGenKey));
  return new Map<number, number>(
    advertiserIds.map((id, i) => [id, toGen(vals[i] ?? null)]),
  );
}

/** MGET a batch of entry keys. Returns raw JSON strings (or null per miss),
 * positionally aligned with `keys`. Throws on a Redis error (caller fails open). */
export async function readRewardEstEntries(
  keys: string[],
): Promise<(string | null)[]> {
  if (keys.length === 0) return [];
  return redis.mget(keys);
}

/** Best-effort write of freshly-priced entries (pipelined SET … EX). Never throws
 * — a write failure must not turn a successful response into a recompute. */
export async function writeRewardEstEntries(
  entries: { key: string; value: string }[],
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const pipeline = redis.pipeline();
    for (const e of entries) {
      pipeline.set(e.key, e.value, "EX", ENTRY_TTL_SECONDS);
    }
    await pipeline.exec();
  } catch {
    // best-effort
  }
}
