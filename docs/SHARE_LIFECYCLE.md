# Share Lifecycle

This document describes the complete share lifecycle from creation to payment, as
of v2.0.0 (the status-model collapse + the admin approval gate).

## The big picture

A share moves along **four independent axes**, not one linear status. Read this
first — the rest of the doc assumes it:

| Axis | Field | Values | Who moves it |
| --- | --- | --- | --- |
| **Payout** | `status` | `PROCESSING` → `PAID` / `UNPAYABLE` | payment worker (born `PROCESSING`) |
| **Moderation** | `approvalStatus` | `PENDING` → `APPROVED` / `REJECTED` | admin (intake gate) |
| **Report** | `report.status` | `PENDING` → `VALID` / `DISMISSED` | advertiser files, admin reviews |
| **Quality** | `rating` | `null` (unrated) → half-stars `1`–`10` (½★–5★); a report is not a rating | advertiser / admin |

**Rejection is NOT a `status`.** The payout `status` only ever tracks the money
(`PROCESSING`/`PAID`/`UNPAYABLE`). A rejected share keeps `status = PROCESSING` —
its rejection lives on `approvalStatus = REJECTED` (intake reject) or on a `VALID`
`ShareReport` (a post-approval report the admin ruled VALID).

The customer never sees these raw axes. The wire exposes one **derived,
customer-facing** status (`CustomerShareStatus`), collapsed server-side by
`deriveCustomerShareStatus` (precedence, highest first):

```
PAID                                      → PAID           (money is final)
approvalStatus REJECTED || report VALID   → REJECTED       (moderation killed it)
status UNPAYABLE                          → UNPAYABLE      (payout failed — terminal)
approvalStatus PENDING                    → UNDER_REVIEW   (awaiting intake review)
report PENDING                            → REPORT_REVIEW  (advertiser report holds the payout)
else                                      → PROCESSING     (in flight)
```

**`UNPAYABLE` outranks `UNDER_REVIEW`.** A share can be voided to `UNPAYABLE`
while still `approvalStatus = PENDING` (worker max-attempts backstop, customer IG
disconnect). That share will never pay, so it must read "failed", not "under
review" (which implies it might still go through).

`UNDER_REVIEW` and `REPORT_REVIEW` are both "we're checking this" holds, but at
different points: `UNDER_REVIEW` is the intake gate (before the share is live),
`REPORT_REVIEW` is a post-approval report awaiting admin review (the share already
passed review + measuring; only the payout is held). `REPORT_REVIEW` is derived
straight off `report.status = PENDING` — it is **not** a stored `status` (the raw
`status` stays `PROCESSING`).

## Main Flow

Creation does **not** kick off a linear pipeline. It starts **two independent
tracks** — **moderation** (admin) and **data capture** (IG workers) — that **join
at the payment worker**. Neither IG worker touches `status`; the *existence* of the
insights + snapshot rows is the "data captured" signal the payment worker keys on.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. SHARE CREATION  (v2: controllers/v2/customerApp/shares/createShare.ts)     │
│    - Customer picks one of their LIVE Instagram stories; media is read from    │
│      the authoritative live story (never trusted from the client) → S3.        │
│    - Rekognition validates the story actually tags the business (no force      │
│      escape hatch in v2) → 4100 on fail.                                       │
│    - Computes estimatedPriceCents / estimatedRewardCents (v2 pricer). For a    │
│      credits-only business the estimate is CAPPED to what the budget can fund  │
│      (never over-promises); subsidized/PAYG estimates are never capped.        │
│    - Stamps the immutable fundingModeAtCreation:                               │
│        SUBSIDIZED — local has an open SubsidizationPeriod                       │
│        CREDITS    — advertiser available budget ≥ the 1.5× est lock, OR        │
│                     (no active PAYG) any available budget > 0 — the lock,      │
│                     placed at admin approval, is capped at what is then        │
│                     available (partial lock bounds what is RESERVED; the       │
│                     customer is still paid in full at settlement)              │
│        PAYG       — credits can't cover the lock, but advertiser has an open    │
│                     PaygPeriod + card on file (takes precedence over a         │
│                     partial-credits lock — the card funds the full price;      │
│                     PAYG has NO monthly spend cap)                             │
│        else → reject (4002 no budget at all)                                   │
│    - Creates the share: status = PROCESSING, approvalStatus = PENDING,         │
│      rating = null.                                                             │
│    - ⚠️ NO budget is locked and the advertiser is NOT notified — both are       │
│      deferred to admin approval. While PENDING the share is fully hidden from   │
│      the advertiser (excluded from every advertiser query/stat).               │
│    - Schedules the IG insights job on the STORY window (postedToIgAt +23h45m,   │
│      valid until +24h) — on the story's OWN timeline, regardless of approval,   │
│      because the story expires at 24h. The data is captured and held until      │
│      approval.                                                                  │
└───────────────┬───────────────────────────────────────────┬──────────────────┘
                │                                             │
   TRACK A: MODERATION (admin)                  TRACK B: DATA CAPTURE (IG workers,
                │                                  independent of approval)
                ▼                                             ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│ 2A. ADMIN REVIEW                      │   │ 2B. INSIGHTS WORKER (igInsights/)     │
│   GET /v2/admin/shares/pending-approval  │   │   - Runs on the story window          │
│                                       │   │     (~24h after posting).             │
│   APPROVE (approveShare):        │   │   - Fetches story insights → writes   │
│     - PENDING → APPROVED (atomic)     │   │     the ShareInsights row.            │
│     - Places the deferred lock by     │   │   - Then queues the snapshot job.     │
│       fundingModeAtCreation: CREDITS  │   │   - Permanent failure / attempts      │
│       → advertiser budget, SUBSIDIZED │   │     exhausted → share UNPAYABLE.      │
│       → platform pool, PAYG → none.   │   │   - Does NOT change status.           │
│       CREDITS lock capped at available│   └───────────────────┬──────────────────┘
│       (partial). Zero → stays PENDING.│                       ▼
│     - Sends a.shares.created.         │   ┌──────────────────────────────────────┐
│                                       │   │ 3B. SNAPSHOT WORKER (igSnapshot/)     │
│   REJECT (rejectShare):          │   │   - Fetches follower count +          │
│     - PENDING → approvalStatus        │   │     audience location → writes the    │
│       REJECTED (status stays          │   │     InstagramSnapshot row.            │
│       PROCESSING). No lock to return  │   │   - Permanent failure / attempts      │
│       (none was placed).              │   │     exhausted → share UNPAYABLE.      │
│     - Penalizes the customer's reward │   │   - Does NOT change status.           │
│       multiplier; keeps the row +     │   └───────────────────┬──────────────────┘
│       media (never hard-deleted).     │                       │
│     - Mandatory c.shares.rejected     │                       │
│       (push + email, with reason).    │                       │
│     - ⛔ NEVER PAID.                   │                       │
└───────────────┬───────────────────────┘                       │
                │ (APPROVED)                                     │
                └─────────────────────────┬─────────────────────┘
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. PAYMENT WORKER (sharePayment/ → executeSharePayment.ts)                    │
│    findSharesReadyForPayment requires ALL of:                                  │
│      • status = PROCESSING                                                     │
│      • approvalStatus = APPROVED   ← the moderation gate                       │
│      • the insights row AND the snapshot row both exist                        │
│      • createdAt ≤ now − 24h  (minPaymentAgeMs: review + cooling-off window)   │
│      • NO PENDING/VALID report (report null or DISMISSED — both hold it)  │
│      • PAYG retry not in backoff (paygNextRetryAt null or due)                 │
│    Computes the final price, then settles by fundingModeAtCreation:           │
│                                                                              │
│    SUBSIDIZED → settleSubsidizedSharePayout: platform pays the customer the   │
│                 full finalPrice (platform lock first, then live Stripe        │
│                 balance). No advertiser involved.                            │
│    CREDITS    → settleSharePayoutAndUnlockRemainder: spend the lock then      │
│                 available — IN FULL, past zero if the budget can't cover it   │
│                 (negative available = the advertiser receivable, netted by    │
│                 their next top-up). Customer always gets finalPrice − 40%     │
│                 platform take; platform keeps the 40% (referral payouts come  │
│                 OUT of it); any unused lock returned to the advertiser. The   │
│                 customer is NEVER shorted (E069 policy, 2026-08-01).          │
│    PAYG       → settlePaygShare:                                             │
│                 • available credits cover it → settle from available          │
│                 • shortfall → charge the card off-session (+surcharge) then   │
│                   settle; decline → close the PAYG period, back off & retry   │
│                   (share stays PROCESSING = "deferred"); attempts             │
│                   exhausted → pay customer in full, advertiser goes negative  │
│                 • no card on file → pay customer in full, advertiser goes     │
│                   negative (uncollectable receivable)                         │
│                                                                              │
│    Success → PAID. Unrecoverable error → UNPAYABLE (any lock returned).       │
└─────────────────────────────────────────────────────────────────────────────┘
```

For CREDITS/PAYG the `finalPrice` is the **gross** value split 60/40 (customer/platform).
For SUBSIDIZED the platform funds the customer's reward directly — the 40% take is
already baked into the price calculation, so nothing is deducted at settlement.

**FinalPrice records the actual outcome.** After settling, each path updates the
share's `FinalPrice` row with `settledGrossCents` (the gross actually collected) and
`capReason` (null = paid in full, else why it was short). Since the pay-in-full
policy (E069, 2026-08-01) advertiser-funded settles can never be short, so the only
value still produced is `PLATFORM_BALANCE` (subsidized, platform Stripe balance too
low — the platform pool has no one to hold a receivable against, so it keeps its
cap). `LOW_BUDGET`/`OVER_LOCK` survive only on historical rows settled before the
policy change. `finalPriceCents` stays what the algo computed the share was worth;
`settledGrossCents` is what was actually paid.

## Approval Gate (intake)

Every share is born `approvalStatus = PENDING` and is **fully hidden from the
advertiser** — no budget lock, no `a.shares.created` notification, excluded from
every advertiser-facing query/stat — until an admin acts. (Internal cap/limit
queries still count PENDING shares, conservatively.)

- **Approve** (`approveShare`) — atomically flips `PENDING → APPROVED` and, in
  the **same transaction**, places the lock creation deferred (CREDITS → advertiser
  budget, SUBSIDIZED → platform pool, PAYG → lock-less). CREDITS locks are capped
  at the then-available budget (`capAtAvailableBudget`) — a thin budget yields a
  partial lock instead of blocking approval; the lock bounds what is *reserved*,
  and settlement still pays the customer in full, drawing available negative past
  the lock (the receivable — E069 policy). Locks have a 1-cent minimum so zero-estimate shares stay
  approvable (settlement requires the SHARE_LOCK event as its currency source of
  truth). Only if the lock can't be placed at all (budget fully drained → 1516,
  platform too low → 1517) does the whole thing roll back and the share stay
  `PENDING`. After commit it sends `a.shares.created`. `fundingModeAtCreation` is
  never re-derived.
- **Reject** (`rejectShare`) — sets `approvalStatus = REJECTED` (status stays
  `PROCESSING`); there is no lock to return (none was placed at creation). Penalizes
  the customer's reward multiplier, keeps the row + media, and sends the mandatory
  `c.shares.rejected` (push + email, with the reason). **Rejection is the only way
  to kill a bad share — there is no hard-delete endpoint.** ⛔ Never paid (the
  payment worker is gated on `approvalStatus = APPROVED`).

## Rating (optional, post-approval)

Once a share is **APPROVED**, the advertiser may rate it (`submitShareAssessment`,
kind `RATING`) — **exactly once**: a share is assessed (rated OR reported) at most
once, ever, and there is no change window; only a never-assessed share
(`ratedAt = null`) can be rated. A PENDING/REJECTED share is invisible to the
advertiser, so it can't be rated.

- Rating is **optional and does not gate payment** — an unrated share is paid
  normally.
- A rating adjusts the **customer's reward multiplier** (a per-star delta via
  `multiplierDeltaForStars`; a report applies no delta), which affects payouts.
- The customer is notified (`c.shares.rated`).

> **What the rating measures — post QUALITY, nothing else.** The advertiser rates
> the **quality of the post itself** (is it a nice, genuine, on-brand piece of
> word-of-mouth?), as a signal of whether *this sharer tends to produce good posts*.
> That signal is the sole purpose of the rating: it feeds the customer's rolling
> quality multiplier, which nudges how much their future shares are worth. It is
> **deliberately NOT** a judgement of the post's **performance** (reach/insights) or
> its **price** — a post that reached few people can still be excellent, and a pricey
> one can be poor. So the rating surface (the advertiser's rate/report sheet)
> intentionally shows **only the post** (media, type, business) and never insights or
> the amount paid; per-share insights aren't even exposed on the advertiser share DTO
> (`AdvertiserSharePreview`). Keep this separation when touching the rating UI or DTO.

> **One assessment endpoint.** Rate + report are ONE endpoint —
> `POST /v2/advertisers/shares/:uid/assessment` (`submitShareAssessment`), a
> discriminated body (`RATING` | `REPORT`) — sharing the once-only write
> `claimShareAssessment` with the admin twin `assessShare`.
> It stores canonical half-stars (`RatingStars`) and, because a
> rating moves `multiplierBps`, bumps the customer's reward-estimate cache
> (`bumpCustomerRewardEstGen`).

> **`ratedAt` invariant — a report counts as a rating.** `ratedAt` is the canonical
> "the advertiser/admin has acted on this share" marker: it's stamped the moment the
> share is first **rated OR reported**, then **preserved, never reset and never
> cleared**, while creation leaves it null. Every write that touches it keeps the
> original via `share.ratedAt ?? now` (`claimShareAssessment` — shared by
> `submitShareAssessment` and the admin `assessShare`, which claim it from null —
> and `reviewShareReport`'s dismiss-with-rating path, which preserves the
> report-filing time rather than re-stamping; the VALID branch reviews an
> already-filed → already-stamped report and doesn't write it). So **`ratedAt IS
> NULL` ⟺ the share is unrated AND unreported**, and that single condition is what
> every "unrated / rate-me" queue filters on (`UNASSESSED_SHARE_WHERE` in the
> advertiser + admin `getUnratedShares` and `getReviewCounts`) — a reported share
> never resurfaces there. Equivalently: a `ShareReport` row always implies `ratedAt` is set.

## Report Flow (post-approval dispute)

An advertiser can report an **APPROVED** share (a PENDING/REJECTED one is invisible
to them). Every approved share that hasn't been assessed yet (`ratedAt IS NULL`) is
reportable.

```
APPROVED share
     │
     ├─── Advertiser reports it (submitShareAssessment, REPORT) ──┐
     │    Once-only: an already-assessed share can't be reported. │
     │    Creates a ShareReport (PENDING), stamps ratedAt.        │
     │    While the report is PENDING the payment worker skips it   │
     │    (held). The customer-facing status derives REPORT_REVIEW  │
     │    (a neutral "under review" hold on the reward — the raw     │
     │    report reason/message is never shown to the customer).    │
     │                                                            │
     │                                                            ▼
     │    ┌────────────────────────────────────────────────────────────┐
     │    │ Admin reviews it (reviewShareReport)                   │
     │    │                                                            │
     │    │ VALID (advertiser was right):                              │
     │    │   • report → VALID. The share row is NOT touched: status   │
     │    │     stays PROCESSING, approvalStatus stays APPROVED. The    │
     │    │     payment gate excludes PENDING/VALID reports, so it is   │
     │    │     never paid; the customer status derives REJECTED.      │
     │    │   • not-yet-paid → the lock is returned (advertiser budget, │
     │    │     or the platform pool if subsidized)                    │
     │    │   • already PAID → stays PAID (no clawback); the penalty    │
     │    │     still applies to future earnings                       │
     │    │   • customer rating multiplier penalized (escalates with   │
     │    │     repeat valid reports)                                  │
     │    │                                                            │
     │    │ DISMISSED (content was fine — a rating is REQUIRED):       │
     │    │   • report → DISMISSED, share rating set (admin must        │
     │    │     supply one), multiplier delta applied; the payment      │
     │    │     worker then pays it normally                           │
     │    └────────────────────────────────────────────────────────────┘
     │
     └─── Not reported → payment worker processes normally
```

## Statuses & axes (reference)

> **Determining share state in code — always via `shareAccess.ts`.** Every
> query, filter, or in-memory check over these axes must compose the named
> predicates in `tagly-backend/src/utils/shares/shareAccess.ts` (Prisma
> `where` fragments · Kysely/SQL fragments · in-memory twins) — never re-inline
> an `approvalStatus`/`status`/`report.status`/`ratedAt` literal. Client-facing
> statuses are derived only by `deriveCustomerShareStatus` /
> `deriveAdvertiserShareStatus` (which themselves compose
> `isRejectedLikeShare` from `shareAccess.ts`). The only sanctioned raw
> literals are state-transition **writes** (`data: { status: "PAID" }`, the
> creation stamp) and the deliberately moderation-agnostic reads documented
> in-file (reward reach history, frequency dampener, visited-businesses,
> `getUnsharedLiveStories`).

**Payout `status`** (the only money axis; born `PROCESSING`):

| Status | Description |
| --- | --- |
| `PROCESSING` | In flight — nothing terminal has happened. A PENDING/UNDER_REVIEW share and a rejected-via-report share both rest here. |
| `PAID` (terminal) | Payment completed successfully |
| `UNPAYABLE` (terminal) | Unrecoverable (insights/snapshot expired, account deleted, payment error); any lock returned |

**Every void carries a user-facing reason.** `markShareUnpayableAndUnlock` (the
single `UNPAYABLE` writer) takes a typed `ShareVoidReason` slug
(`IG_DISCONNECTED` / `IG_DATA_DELETED` / `ACCOUNT_DELETED` /
`INSIGHTS_UNAVAILABLE` / `SETTLEMENT_FAILED`, `@tagly/models` core) stamped to
`Share.voidReason` and surfaced on the v2 customer + advertiser share details;
raw technical text goes in the separate `detail` arg → `lastProcessingError`
(admin-only) and can never reach a client. Client mapping is deliberately
asymmetric: the **customer** app renders a specific line per slug
(`ACCOUNT_DELETED` falls to the generic line — the owner can't be reading their
own share), while the **advertiser** app is deliberately coarse (Matej,
2026-08-02): `INSIGHTS_UNAVAILABLE` gets its own line, every other slug
collapses to the generic "couldn't be processed, you won't pay for it" — the
specific cause is irrelevant to the payer. Null slugs (pre-column voids) render
the generic line in both apps.

**Moderation `approvalStatus`** — `PENDING` (hidden from advertiser, no lock) →
`APPROVED` (lock placed, advertiser notified) / `REJECTED` (never paid; status stays
`PROCESSING`).

**Report `status`** — `PENDING` (holds payment; customer sees `REPORT_REVIEW`) →
`VALID` (holds payment forever = effectively rejected) / `DISMISSED` (payment
proceeds).

**`rating`** — half-stars `1`–`10` (½★–5★), `null` = unrated. "Reported" is not a
rating — it lives on the `ShareReport` row + the derived status.

**Derived customer-facing `CustomerShareStatus`** (never stored — see
`deriveCustomerShareStatus`): `UNDER_REVIEW` / `REPORT_REVIEW` / `PROCESSING` /
`PAID` / `UNPAYABLE` / `REJECTED`.

## Funding Mode

Every share is stamped at creation with an immutable `fundingModeAtCreation` (`CREDITS | PAYG | SUBSIDIZED`) — the **canonical signal** for who funds it. It is derived at creation: an open `SubsidizationPeriod` → `SUBSIDIZED`, else enough advertiser available budget to place the full 1.5× lock → `CREDITS`, else an open `PaygPeriod` + card on file → `PAYG`, else any available budget > 0 → `CREDITS` with a partial lock (capped at the budget available at admin approval; the customer is still paid in full at settlement, with the un-locked remainder drawing available negative — the advertiser receivable). Read this field — not the `SubsidizationPeriod` overlap or `advertiserId` — for any per-share subsidization check at approval / settlement / admin / hydration time. See [tagly-backend/CLAUDE.md](../tagly-backend/CLAUDE.md) §"Share Funding Mode & the Subsidized Invariant".

The **actual** funding source at settlement is **not** stored on the share — derive it from the ledger if needed (the `SHARE_PAYMENT` deltas / a `PAYG_CHARGE` event). The ledger remains the single source of truth for money movement.

**Creation → settlement invariant:**

- `SUBSIDIZED` at creation → settles subsidized (platform pays). Immutable.
- `CREDITS` at creation → settles from credits (advertiser budget). Immutable.
- `PAYG` at creation → settles via `settlePaygShare`, and the **actual money source can vary**: available/promo credits may cover it (card untouched), or — if the card was removed while the share was in-flight — the customer is still paid in full while the advertiser's balance goes negative (an uncollectable receivable). In-flight PAYG shares are **never** converted to locked-credit shares; they stay lock-less. `fundingModeAtCreation` itself never changes — only the settlement money source varies, and only for `PAYG`.

## Key Files

- **Share-axis predicates (single source of truth)**: `tagly-backend/src/utils/shares/shareAccess.ts`
- **Creation**: `tagly-backend/src/controllers/v2/customerApp/shares/createShare.ts`
- **Admin approve / reject**: `tagly-backend/src/controllers/v2/adminApp/shares/{approveShare,rejectShare}.ts` (queues: `getSharesPendingApproval.ts`, `getSharesPendingReport.ts`; counts: `../review/getReviewCounts.ts`)
- **Insights Worker**: `tagly-backend/src/workers/igInsights/`
- **Snapshot Worker**: `tagly-backend/src/workers/igSnapshot/`
- **Payment Worker**: `tagly-backend/src/workers/sharePayment/` (ready-query: `helpers/findSharesReadyForPayment.ts`; dispatch: `helpers/executeSharePayment.ts`)
- **PAYG settlement**: `tagly-backend/src/workers/sharePayment/helpers/settlePaygShare.ts`
- **Budget Lock**: `tagly-backend/src/utils/money/ledger/events/sharePayment/lockBudgetForShare.ts` (partial-lock cap + concurrency re-check)
- **Settlement (credits/PAYG)**: `tagly-backend/src/utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.ts` (returns `actualGrossPaid`/`capReason`)
- **Settlement (subsidized)**: `tagly-backend/src/utils/money/ledger/events/sharePayment/settleSubsidizedSharePayout.ts` (returns `actualPaid`/`shortfall`)
- **Reward-estimate cache**: `tagly-backend/src/utils/pricing/rewardEstCache.ts` (customer/business/advertiser gens; advertiser gen invalidates budget-capped estimates)
- **PAYG card removal**: `tagly-backend/src/controllers/v2/advertiserApp/billing/payg/removePaygCard.ts`
- **Rating / reporting**: `tagly-backend/src/controllers/v2/advertiserApp/shares/submitShareAssessment.ts`
- **Report Review**: `tagly-backend/src/controllers/v2/adminApp/shares/reviewShareReport.ts` (admin rate/report of subsidized shares: `assessShare.ts`; shared once-only claim: `tagly-backend/src/utils/shares/claimShareAssessment.ts`)
- **Derived customer status**: `tagly-backend/src/utils/hydrators/shares/deriveCustomerShareStatus.ts`
</content>
</invoke>
