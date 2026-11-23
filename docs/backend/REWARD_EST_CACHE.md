# Reward-Estimate Cache — invalidation is the whole game

> Deep-dive referenced from [tagly-backend/CLAUDE.md](../../tagly-backend/CLAUDE.md).
> The one-line rule there: anything that writes an input of `calculateEstPrices`
> MUST bump the matching generation counter. This file is the full wiring.

Display reward estimates (Discover / map / preview) are cached read-through in
`utils/pricing/getEstPricesCached.ts`, with the pricer `calculateEstPrices` as the
miss path. **Share *creation* never reads the cache** — it prices fresh, because that
estimate becomes the real reward basis.

Correctness hinges on invalidation. **Three** generation counters
(`utils/pricing/rewardEstCache.ts` — the ledger writer bumps the advertiser
counter, see below), all embedded
in the cache key, plus a 24h backstop TTL. The value shape is also guarded by an
`s2` schema token in the key: bump it whenever `SerializedEst` in
`getEstPricesCached.ts` gains/loses a field, so pre-deploy entries can't hydrate as
`undefined`. **If you write anything that feeds `calculateEstPrices`, you MUST bump
the matching generation** (check the pricer's inputs if unsure):

- **Per-customer input → `bumpCustomerRewardEstGen(customerId)`.** Triggers: a **new
  IG snapshot** (igSnapshot worker), a new share (createShare), an IG state change
  (connect / disconnect / refresh — bump on *refresh* only when `followerCount`
  actually changed, since refresh is re-probed on every app foreground), interests
  edits, **customer rating (`multiplierBps`) changes**, and **story-views updates**
  (`updateEstimatedStoryViews` — the no-IG reach fallback is the server-owned
  `Customer.estimatedStoryViews`, E062; there is deliberately NO request-supplied
  reach param anywhere in v2, so every estimate is a pure function of server state
  and every result shape is cacheable — never reintroduce a per-request pricing
  input without adding it to the key).
- **Per-business input → `bumpBusinessRewardEstGen(businessId)`.** Triggers: a
  **business address / relocation**, type change, or **subsidization start/stop** —
  these move the estimate for *every* customer, so a per-customer bump can't cover
  them.
- **Per-advertiser input → `bumpAdvertiserBudgetGen(advertiserId)`.** The pricer now
  **caps a credits-only estimate at what the advertiser's budget can fund** (Part B
  of the budget work), so a budget or PAYG-active change flips capping. This counter
  is bumped automatically by **`applyBalancesFromEvent`** on every ledger money
  movement (purchases, refunds, locks/unlocks, settles, PAYG charges — controllers +
  workers + webhooks; fire-and-forget, fail-open), plus **explicitly** by the PAYG
  card endpoints (setup / reconcile / remove) since a PAYG-active flip
  has no ledger event. `getEstPricesCached` resolves each business's advertiser via
  the permanent `getBusinessAdvertiserIds` (a null advertiser → sentinel gen 0;
  subsidized estimates are never capped) and folds that advertiser's gen into the key.

Anything you miss only falls back to the 24h TTL — fine for a slow input, wrong to
rely on for a fast-moving one. `LOCAL_REWARD_ALGO_VERSION` is in the key, so bumping
it invalidates everything on a pricing-algo deploy.

## Current wiring

The per-customer triggers are wired in v2 (+ the worker), now **including the rating
bump** — the v2 advertiser assessment endpoint
(`controllers/v2/advertiserApp/shares/submitShareAssessment.ts`) calls
`bumpCustomerRewardEstGen` after any rate/report that moved the customer's
`multiplierBps`. The **advertiser** counter is fully wired (ledger chokepoint +
PAYG endpoints). The **business-side** bumps now have v2 writers too: the shared
business-update core (`utils/businesses/write/updateBusinessCore.ts` — behind BOTH the
advertiser PATCH and the admin PATCH) bumps on a `typeSlug`/`address` change, and
`deleteBusiness` bumps on removal, and **admin subsidization start/stop is now wired
too** (`controllers/v2/adminApp/businesses/setBusinessSubsidized.ts` bumps on
both open and close, and the admin advertiser-handover
`setBusinessAdvertiser.ts` bumps on assignment) — every business-side trigger
has a v2 writer.
