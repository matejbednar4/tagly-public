# Share Payment Flow

## Overview

Handles the financial lifecycle of a local share: locking funds when a share is created, settling the actual payment when insights are collected, and unlocking funds if the share fails. Two parallel paths exist depending on whether the local was subsidized by the platform at share creation time.

Subsidization is determined by checking whether the local had an open `SubsidizationPeriod` at `share.createdAt` — not from the current state of the local, and not from `advertiserId`.

---

## Events

### 1. `SHARE_LOCK` — Reserve funds for estimated share price

- **File:** `lockBudgetForShare.ts`
- **Trigger:** Customer creates a share (`createLocalSubaccountShare`)
- **Lock amount:** `estimatedPrice × LOCK_BPS_OF_EST_PRICE` (~1.5×) to buffer for price fluctuation
- **Idempotency:** `externalRef = share:{shareId}:lock:v1`
- **Zero-sum:** Advertiser path yes (available → locked); platform path no (locked counter increment only)

**Advertiser path** (`isSubsidized: false`):

- Checks `advertiser.availableBudgetCents >= lockCents`
- Deltas: `deltaAdvertiserCents: -lockCents`, `deltaAdvertiserLockedCents: +lockCents`

**Platform path** (`isSubsidized: true`):

- Checks live Stripe unassigned balance (via `retrieveAvailableStripeBalance`) >= lockCents
- Deltas: `deltaPlatformLockedCents: +lockCents` (increments `PlatformBalance.lockedCents`)

---

### 2. `SHARE_PAYMENT` — Settle actual payment to customer

Two separate implementations depending on subsidization at creation time.

#### 2a. Regular shares — `settleSharePayoutAndUnlockRemainder.ts`

- **Trigger:** `executeSharePayment` after final price calculated (not subsidized)
- **Deltas:**
  - `deltaAdvertiserLockedCents: -usedFromLock` (consume lock first)
  - `deltaAdvertiserCents: -(grossPrice - usedFromLock)` (top up from available if lock insufficient)
  - `deltaCustomerCents: +customerNet` (customer receives gross minus 40% platform fee)
  - `deltaPlatformCents: +platformFee` (full 40% booked; referral payouts debit this in separate events)
- **Idempotency:** `externalRef = share:{shareId}:payment:v1`
- **Zero-sum:** Yes
- **Note:** Also creates `REFERRAL_PAYOUT` events for advertiser and/or customer referrers if applicable

#### 2b. Subsidized shares — `settleSubsidizedSharePayout.ts`

- **Trigger:** `executeSharePayment` after final price calculated (wasSubsidizedAtCreation)
- **finalPriceCents** is already net (40% take was baked into the price at calculation time)
- Pays from platform lock first, then checks live Stripe for any shortfall
- **Deltas:**
  - `deltaCustomerCents: +actualPaid` (full final price — no deduction)
  - `deltaPlatformLockedCents: -usedFromLock` (consume lock)
  - `deltaPlatformCents: -actualPaid` (platform cost)
- **Idempotency:** `externalRef = share:{shareId}:payment:v1`
- **Zero-sum:** No
- **Note:** Creates a `REFERRAL_PAYOUT` for the customer's referrer only (no advertiser referrer). Bonus = `actualPaid × (PLATFORM_TAKE_BPS / (10000 - PLATFORM_TAKE_BPS)) × referrerBps`

---

### 3. `SHARE_UNLOCK` — Release locked funds

Three scenarios:

**a) Remainder after regular settlement** (`settleSharePayoutAndUnlockRemainder.ts`):

- Unlocks excess advertiser locked funds after payment (lock was ~1.5×, actual price may be less)
- Deltas: `deltaAdvertiserLockedCents: -remainder`, `deltaAdvertiserCents: +remainder`
- `externalRef = share:{shareId}:unlock-remainder:v1`

**b) Remainder after subsidized settlement** (`settleSubsidizedSharePayout.ts`):

- Unlocks excess platform locked funds if lock exceeded actualPaid
- Deltas: `deltaPlatformLockedCents: -remainder`
- `externalRef = share:{shareId}:unlock-remainder:v1`

**c) Full unlock on failure** — two variants:

- `unlockLockedBudgetForShare.ts` (regular): `deltaAdvertiserLockedCents: -locked`, `deltaAdvertiserCents: +locked` — `externalRef = share:{shareId}:unlock:v1`
- `unlockPlatformBudgetForShare.ts` (subsidized): `deltaPlatformLockedCents: -locked` — `externalRef = share:{shareId}:unlock:v1`

Both return a no-op if nothing is locked.

---

## Flows

### Happy path — regular (advertiser-funded)

```
Customer creates share
  |
  v
SHARE_LOCK (~1.5× estimated, advertiser available → locked)
  |
  v
Instagram insights collected, final price calculated
  |
  v
SHARE_PAYMENT (advertiser locked + available → customer net + platform fee)
  + REFERRAL_PAYOUT (advertiser and/or customer referrer, if applicable)
  |
  v
SHARE_UNLOCK remainder (excess advertiser locked → available)
```

### Happy path — subsidized (platform-funded)

```
Customer creates share
  |
  v
SHARE_LOCK (~1.5× estimated, platform lockedCents incremented)
  |
  v
Instagram insights collected, final price calculated
  (price = algo result × 0.7 cap, then × 0.6 — take baked in)
  |
  v
SHARE_PAYMENT (platform lock → customer full finalPriceCents)
  + REFERRAL_PAYOUT (customer referrer only, bonus = feeEquivalent × referrerBps)
  |
  v
SHARE_UNLOCK remainder (excess platform lock released, if any)
```

### Failure path — regular

```
SHARE_LOCK (advertiser available → locked)
  |
  v
Payment fails (any reason)
  |
  v
Share → UNPAYABLE
SHARE_UNLOCK full (advertiser locked → available)
```

### Failure path — subsidized

```
SHARE_LOCK (platform lockedCents incremented)
  |
  v
Payment fails (any reason)
  |
  v
Share → UNPAYABLE
SHARE_UNLOCK full (platform lockedCents decremented)
```

---

## Orchestration

`executeSharePayment.ts` owns the full payment execution:

1. Validates `customerId` and `localId` are present
2. Reads `wasSubsidizedAtCreation` from the immutable `fundingModeAtCreation` stamp (never re-derived from the `SubsidizationPeriod` or `advertiserId`)
3. Calls `calculateShareFinalPriceCents` (pure calculation, no DB writes)
4. In a single `$transaction`: atomically claims `PROCESSING → PAID` first (`markSharePaidOrThrow` — losing the claim to a concurrent void rolls back and returns outcome `skipped`), creates `FinalPrice`, calls the appropriate settle function
5. On error, classified by kind:
   - **domain error** (`createCustomError` — pricing invariants, ledger flow violations) → PERMANENT: CAS-claims `PROCESSING → UNPAYABLE` and, only if the claim wins, calls the appropriate unlock function (a lost claim means a concurrent void already released the lock)
   - **anything else** (DB hiccup, Stripe timeout, network) → TRANSIENT: share stays `PROCESSING`, deferred via `paygNextRetryAt` (+`transientRetryBackoffMs`); all ledger writes are idempotent so the retry is safe

The payment worker polls for `PROCESSING` shares that are `approvalStatus = APPROVED`, have both their insights + snapshot rows, are ≥24h old, and carry no open/upheld report. `advertiserId` may be null for subsidized shares but is not the signal — subsidization is always determined by the SubsidizationPeriod overlap at `share.createdAt`.
