# Withdrawals — the payout leg, reconciliation, and state ownership

> Reconstructed 2026-08-07 (the original file was lost in the repo restructuring;
> every W-/D-numbered rule below is re-derived from the code comments that cite
> it). The ledger-event side (lock → transfer → settle wrappers) is documented in
> `utils/money/ledger/events/withdrawals/FLOW.md`; this file covers the
> `StripeWithdrawal` row, the payout-to-bank leg, and the reconciliation worker.

## Unified StripeWithdrawal model

One row per withdrawal, with **two independent lifecycles**:

- **`status`** — the LEDGER summary only:
  - `PENDING` — money left the customer's Tagly balance, not yet resolved
  - `FAILED` — the transfer was definitively rejected; nothing left, balance unlocked
  - `COMPLETED` — the payout reached the bank (`payout.paid`)
  - `REVERSED` — the transfer was fully clawed back; balance credited back
- **`payoutStatus`** — the payout leg, describing **real payout objects only**:
  `NONE` / `IN_FLIGHT` / `PAID` / `FAILED` / `CANCELED`. A payout **create**
  failure never touches it (no payout object exists); that state lives in
  `payoutAttempts` + `nextPayoutRetryAt` instead.
- Supporting columns: `settledAt` (the WITHDRAWAL settle event committed),
  `payoutAttempts` + `nextPayoutRetryAt` (the W-19/W-21 retry schedule),
  `failureCode`/`failureMessage` (**latest** transfer/payout failure or W-21
  deferral marker (`funds_not_yet_available`) — overwritten per attempt,
  cleared on `payout.paid`; never a reversal signal, never branched on),
  `reversedCents` (W-6: the SOLE reversal signal), `stripeAccountId` + `purpose`
  stored ON the row (W-2/W-3: reconciliation is self-sufficient even after the
  customer row is deleted/nulled), `stripeTransferId`, `stripePayoutId` (always
  the LATEST payout attempt).

## One transition owner

**Only the `record*` helpers in `withdrawalTransitions.ts` may write `status`,
`payoutStatus`, `failureCode`, `failureMessage`, `settledAt`, `payoutAttempts`,
`nextPayoutRetryAt`, `stripePayoutId`.** The orchestrator, the payout util, the
Connect webhook handlers, and the reconciliation worker all route through them:

| Helper | Trigger | Effect |
| --- | --- | --- |
| `recordTransferSucceeded` | transfer created | persist `stripeTransferId` (crash-recovery marker) |
| `recordTransferFailed` | transfer definitively rejected | `status FAILED` + failure fields (caller unlocks the balance in the same tx) |
| `recordSettled` | WITHDRAWAL settle event committed (same tx) | `settledAt` (idempotent, first wins) |
| `recordPayoutCreated` | `payouts.create` succeeded | `stripePayoutId`, `payoutStatus IN_FLIGHT`, `payoutAttempts + 1`, clears `nextPayoutRetryAt` |
| `recordPayoutPaid` | `payout.paid` (webhook/poll) | `status COMPLETED`, `payoutStatus PAID`, clears failure fields (stale-attempt + already-resolved guarded) |
| `recordPayoutFailed` / `recordPayoutCanceled` | `payout.failed`/`payout.canceled` | `payoutStatus FAILED/CANCELED` + failure fields + retry schedule (backoff; parks at cap); D1: flips a COMPLETED row back to PENDING on a late bounce |
| `recordPayoutCreateFailed` | W-19: the **create call** threw | definitive → count attempt + backoff (parks at cap) + persist failure fields; ambiguous → short same-key recheck only |
| `recordPayoutCreateDeferred` | W-21: funds still `pending` on the account (typed 1723 from the payout util's gate, before `payouts.create`) | `nextPayoutRetryAt = max(available_on + buffer, now + recheck)`; NO attempt counted, NO key rotated; failure fields = `funds_not_yet_available` |
| `scheduleImmediatePayoutRetryForAccount` | `account.updated` payouts re-enabled / external account changed | `nextPayoutRetryAt = now` on every stuck row of the account — **including parked ones** (D4 amendment) |
| `parkPayoutRetries` | reconciliation determined no retry can ever succeed | `nextPayoutRetryAt = null`; always paired with a team alert by the caller (D4) |
| `recordReversal` | reversal booked (same tx as the ledger event) | `reversedCents`; `status REVERSED` when full |

Stripe errors around money movement are classified only by
`stripeErrorClassification.ts` (`isDefinitiveStripeRejection`) — W-17: shared by
the orchestrator and the worker so the sites can never drift. Only a definitive
rejection may release locked funds; anything ambiguous keeps state and
reconciles against Stripe later (W-16). Payout-create throws additionally
classify via `isDefinitivePayoutCreateFailure` (adds the payout util's own
`{ permanent: true }` derivation errors, which fire before `payouts.create`).

## The flow (v2 — standard payouts only; instant was dropped)

1. Ensure the connected account is on a **`manual` payout schedule** (W-13/D6:
   before any ledger write, throw-with-zero-side-effects on failure) — we own
   every payout, so each carries `withdrawalUid` metadata and reconciles.
2. Lock the balance (ledger) + create the row, one tx.
3. Create the Stripe transfer (deterministic idempotency key). Definitive
   rejection → unlock + FAILED. Ambiguous → row stays PENDING with no transfer
   id; the worker's missing-transfer pass lists → **adopts-or-creates**
   deterministically (D5).
4. Persist the transfer id, then settle the ledger + `recordSettled`, one tx.
5. Create the standard payout **inline, best-effort** (failure recorded like
   W-19, then the worker takes over). `payout.paid`/`payout.failed` webhooks
   settle the leg, with the worker's poll pass as backstop.

### W-20 — payout denomination (the CZ fix, 2026-08-07)

The payout amount/currency are **derived from the transfer's destination
payment on the connected account**, never echoed from the USD ledger figures:
`balance_transaction.net` in `balance_transaction.currency`, minus the
payment's `amount_refunded` (reversals surface there in the account currency —
E033-safe without cross-currency math). A CZ account settles the USD transfer
in EUR (Stripe FX, minus the conversion fee), so echoing the ledger's
`600/"usd"` produced a guaranteed `balance_insufficient` forever. On a USD
account the derivation returns exactly the transfer's own amount/currency, so
the US path is value-identical. The derived figure is deliberately **not
persisted** — the DB stays USD-only; Stripe's payout object is the durable
record. Policy (approved 2026-08-07): the customer absorbs the FX fee — the
net is the only amount guaranteed available.

## The reconciliation worker (stripe worker passes)

| Pass | Picks up | Action |
| --- | --- | --- |
| W-3a `resolveMissingTransfer` | PENDING, no transfer id, past grace | list Stripe → adopt-or-create the transfer (D5) |
| W-3b `settleWithdrawal` | PENDING, transfer id, `settledAt` null | replay `createWithdrawalFromLocked` (idempotent on transfer id) + `recordSettled` |
| `createMissingWithdrawalPayout` | PENDING, settled, `payoutStatus NONE`, due | create the payout (W-20 denomination; W-19 failure handling) |
| W-1 `retryWithdrawalPayout` | PENDING, `payoutStatus FAILED/CANCELED`, `nextPayoutRetryAt` elapsed | W-18 reversal sync, then a genuinely new payout under a rotated key |
| `pollWithdrawalPayout` | PENDING, IN_FLIGHT, old | missed-webhook backstop |

Every pass guarantees **forward motion** — no row may be re-queried every 30s on
unchanging state: failures advance the schedule (W-19), impossible rows are
excluded in the finder queries or parked + alerted.

### W-19 retry policy (tunables in `constants/workers/STRIPE.ts`)

Stripe caches error results under an idempotency key for ~24 h, so a same-key
retry replays the cached error. Counting a **definitive** create failure as an
attempt rotates the next key (`attempts + 1`) into a real request. Backoff:
`min(1h × 2^(attempts−1), 24h)`; at `maxPayoutAttempts` (5) the row **parks**
(`nextPayoutRetryAt = null`) and `sendPayoutRetriesExhaustedAlert` emails the
team (D4: parked money is a human's job). **Ambiguous** create failures never
count an attempt or rotate the key — a short recheck either adopts the created
payout or re-executes. D4 amendment: a fix-event re-arm
(`scheduleImmediatePayoutRetryForAccount`) always grants exactly one more
attempt, even on a parked row — W-1 eligibility is `nextPayoutRetryAt` alone,
deliberately with no attempts cap.

### W-21 — funds-availability deferral (2026-08-12)

The attempts budget measures **real** payout failures only. Funds a transfer
lands on a connected account stay `pending` until Stripe's `available_on`
(T+1 typically; the release itself can lag hours behind the stamp), and a
payout created before then is a guaranteed `balance_insufficient`. Under plain
W-19 those burned the whole budget: wd-G1oqVLiCo (2026-08-11) spent all 5
attempts across ~15 h against funds that released 9½ h after the last attempt,
then parked + D4-alerted with nothing actually wrong.

Mechanism: `createStandardWithdrawalPayoutOrThrow` checks the destination
payment's balance transaction `status` and throws the **typed 1723 deferral**
(with `available_on` attached — extracted by `getPayoutFundsAvailableAt`)
BEFORE `payouts.create`, so no attempt is consumed and the idempotency key is
never burned with a cached error (same-key reuse after a deferral is a real
request). Both catch sites (`handlePayoutCreateFailure`, the inline catch)
check the deferral FIRST, then fall through to the definitive/ambiguous split;
`recordPayoutCreateDeferred` schedules
`nextPayoutRetryAt = max(available_on + payoutFundsAvailabilityBufferMs,
now + payoutFundsPendingRecheckMs)` — one precisely-timed wake-up, degrading
to an hourly recheck when the stamp has passed but release lags. The gate sits
AFTER the 1722 nothing-payable guard, so a fully-reversed row still reaches
its terminal verdict instead of deferring forever.

Deferral is attempt-free and therefore can never park — the
no-silent-stuck-money guarantee is kept by the worker-side **horizon alert**:
a row still deferring `payoutFundsAvailabilityAlertAfterMs` (14 d) after
creation escalates to the team (deduped; usually Stripe holding funds for
review). If a 1723 ever reaches `recordPayoutCreateFailed` unintercepted, it
classifies ambiguous (attempt-free short recheck) — degraded but still safe.

Precision note: the Connect webhook endpoint does NOT subscribe to
`balance.available`; deferral timing is poll-based by design. Subscribing and
pulling scheduled retries forward on that event would shave the recheck
latency to ~30 s if ever needed.

## Customer display

`utils/hydrators/billing/deriveWithdrawalDisplayState.ts` is the **single collapse
point** from `(status, payoutStatus, payoutAttempts, nextPayoutRetryAt)` to the
customer-facing state. PENDING renders DELAYED when a payout FAILED/CANCELED
**or** the create-side is parked (`payoutStatus NONE`, `payoutAttempts > 0`,
`nextPayoutRetryAt null`) — a parked row must never show "on its way".

## Idempotency keys (the only double-payout protection)

- Transfer: `withdraw:{uid}:transfer:{purpose}:v1`
- Payout: `withdraw:{uid}:payout:standard:{purpose}:{attemptKey}` — attemptKey
  `"v1"` for the first payout (inline + worker create-pass share it), the
  attempt number (`attempts + 1`) for every retry.

W-10: Stripe metadata carries only `withdrawalUid` + `purpose` — internal
numeric DB ids are never sent to (or read back from) Stripe. The `purpose`
vocabulary (DB enum ↔ wire strings) is single-sourced in
`withdrawalPurpose.ts`.
