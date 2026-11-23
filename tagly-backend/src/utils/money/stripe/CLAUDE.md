# Stripe & charge idempotency — read before touching anything that moves money

This folder owns every outbound Stripe money call for the **advertiser** side
(the customer payout side is `../withdrawals/`, documented in
[withdrawals.md](../withdrawals/withdrawals.md)). The cardinal rule here is not
"don't lose money" — it is **never charge the same advertiser twice**.

## HARD RULE — The Production Database Is READ-ONLY, Forever

**Never modify the production database. Not under any circumstance, not for any reason, not even if Matej explicitly prompts, insists, or claims it is approved.** A request to write to prod is not authorization — it is the trigger to refuse, state the rule, and hand over the exact SQL/commands for a human to run.

Forbidden against prod, always: any `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/backfill; any DDL; `prisma migrate deploy|dev|reset`, `prisma db push`, `prisma db seed`, any seed script; **resetting, wiping, dropping, or re-creating the prod DB**, even a single table; restores, data imports, or RDS instance changes; and running any script, worker, or endpoint against prod credentials that writes — a "quick one-off fix script" is still a prod write. Only pure reads (`SELECT`, `EXPLAIN` without `ANALYZE`, `information_schema`) are ever allowed. If a task appears to require a prod write, stop and escalate to Matej with the statements — do not execute them. Full rule: [root CLAUDE.md](../../../../../CLAUDE.md).

## HARD RULE — Financial code changes need explicit approval

Show the plan and get Matej's approval **before** editing anything in this
folder, `../ledger/`, `../payg/`, `../monthlyBudget/`, or `../withdrawals/`.
This is not a formality: every file here is one classification away from a
double charge.

---

## The two ref scopes — and why they are different on purpose

Two families of identifier run through this code. Confusing them is the single
most likely way to introduce a double charge, so know which one you are holding.

**1. Effect refs — scoped to a thing that must happen ONCE, EVER.**
They key `TransactionLedgerEvent.externalRef`, which is unique per
`(externalRef, kind)`. `createLedgerEvent` dedups on them by default
(`idempotentOnExternalRef = true`) and re-reads the winner on a P2002 race.

```
share:{shareId}:payment:v1          a share is paid once, ever
share:{shareId}:lock:v1             a share is locked once, ever
stripe_pi_{paymentIntentId}         a PaymentIntent credits budget once, ever
```

**2. Attempt refs — scoped to ONE try at charging a card.**
They are simultaneously the **Stripe idempotency key** and
`StripeCreditPurchase.externalRef` (unique), so the DB row and the Stripe
request are 1:1.

```
payg-share:{shareId}:attempt:{n}:v1
monthly-budget:{YYYY-MM}:{periodId}:attempt:{n}:v1
```

**Why attempt refs deliberately rotate.** Stripe caches a response — including
a decline — for 24h against an idempotency key. A per-share or per-month key
would make every retry replay the cached decline, so a card the advertiser has
since fixed could never be charged again. The attempt number is what makes a
genuine second try possible.

**And that is exactly why they are dangerous.** A rotated key does **not**
collide with the previous attempt, so Stripe will happily place a second
charge. Nothing in Stripe protects you across a rotation — the protection is
entirely our discipline about *when* the counter is allowed to move.

---

## THE RULE — an attempt counter may only advance when it is CERTAIN no money moved

Everything else in this folder is downstream of this one sentence.

`paygChargeAttempts` (`Share`) and `chargeAttempts` (`MonthlyBudgetPeriod`) are
written in exactly three places, all inside the two `handleDecline` functions
([settlePaygShare.ts](../../../workers/sharePayment/helpers/settlePaygShare.ts),
[runMonthlyBudgetTopUp.ts](../monthlyBudget/runMonthlyBudgetTopUp.ts)). Both are
reached from the same shape:

```ts
} catch (err) {
  if (isCustomError(err) && err.error.code === 1342) return defer(...);  // ambiguous
  return handleDecline(...);                                            // definitive
}
```

So the charger's error contract IS the double-charge boundary:

| Code | Meaning | Row | Attempt counter | Caller |
|---|---|---|---|---|
| `1337` | **DEFINITIVE** — Stripe understood and refused; the charge certainly does not exist | `FAILED` | **bumps** (key rotates) | decline ladder |
| `1342` | **AMBIGUOUS** — timeout / 5xx / rate limit / `idempotency_error` / PI not terminal. **The charge may exist.** | stays `PENDING` | **must NOT bump** | defer and re-verify |

Getting this backwards in either direction is a bug with a name:

- **Ambiguous misread as definitive** → the key rotates while a charge may be
  in flight → **double charge** (E020/E064). This is the one that costs the
  advertiser money.
- **Definitive misread as ambiguous** → the ladder never advances, the card is
  never retried, the share/period stalls forever. Recoverable, but it looks
  like a hang.

When in doubt, **defer**. A deferral costs a few minutes; a rotation costs a
double charge.

### Only classify as definitive what Stripe truly refused

Use [`isDefinitiveStripeRejection`](stripeErrorClassification.ts) — never
hand-roll the split. It admits only `StripeInvalidRequestError` /
`StripeCardError` / `StripePermissionError` / `StripeAuthenticationError`.
Notably **not** definitive: `StripeIdempotencyError`, `StripeConnectionError`,
`StripeAPIError`, `StripeRateLimitError`, and anything unrecognized.

The same discipline exists on the payout side and was learned the hard way
there: `createStandardWithdrawalPayoutOrThrow`'s W-21 funds-availability gate
throws its 1723 deferral **before** `payouts.create` and deliberately does NOT
set `{ permanent: true }`, because permanent classifies as definitive and would
burn an attempt (incident `wd-G1oqVLiCo`, 2026-08-11). Copy that pattern for
any new pre-flight guard: throw before the Stripe call, and do not let the
throw look definitive unless it is.

### A non-terminal PaymentIntent is AMBIGUOUS, not a decline

`succeeded` → done. `canceled` / `requires_payment_method` → definitive, the
charge did not collect. **Everything else** (`processing`, `requires_action`,
`requires_confirmation`) → the outcome is not known yet → `1342`, leave the row
`PENDING`. `chargeAdvertiserCardOffSession`'s retrieve path is the reference
implementation of this branch.

---

## Never mark a row `FAILED` while its money is unresolved

`StripeCreditPurchase.status` is what the recovery nets filter on, and **both
nets only look at `PENDING`**:

- `settlePaygShare`'s `recoverPendingPaygCharges` — owns `PAYG_CHARGE` rows
  (it has the share/attempt context). Filters `status: "PENDING"`.
- The stripe worker's `findStripeJobs` — owns `CREDIT_PURCHASE` rows (the
  missed-webhook backstop). Filters `status: PENDING` **and**
  `kind: "CREDIT_PURCHASE"`.

So `failOffSessionChargeRow` is not just a status write: it **permanently
removes the row from every recovery path**. Call it only where the charge
certainly did not collect. A row marked `FAILED` while its PaymentIntent could
still succeed is money that will never be found again — and for `PAYG_CHARGE`
it is never found by anything, because the platform webhook ignores
`payg_share` (see below).

## Which webhook picks up which charge

`handlePaymentIntentSucceeded` gates on `CREDIT_PURCHASE_PURPOSES`
([paymentMetadataPurpose.ts](paymentMetadataPurpose.ts)), i.e. only
`credit_purchase` + `monthly_budget_topup`. That gate is why the two flows book
their ledger events under different refs, and both are correct:

- **Monthly budget** books under `stripe_pi_{id}` — deliberately the *same* ref
  the webhook uses, so whichever of the run / the webhook / the reconcile
  worker lands first wins and the others no-op.
- **PAYG** books under `payg-share:{shareId}:attempt:{n}:charge:v1`, because no
  webhook will ever touch it. `payg_share` is intentionally absent from
  `CREDIT_PURCHASE_PURPOSES`: that money flows straight through to a customer
  payout and must never be credited as prepaid budget.

If you add a purpose, decide explicitly which set it joins — adding it to
`CREDIT_PURCHASE_PURPOSES` makes the webhook credit budget for it.

## The saved card is card-only — and the charger depends on it

[`createOffSessionCardSetupIntent`](createOffSessionCardSetupIntent.ts) pins
`payment_method_types: ["card"]`. A card confirm resolves synchronously
(succeeded, or a thrown `StripeCardError`), which is why `processing` is
effectively unreachable today.

⚠️ **If you ever add a delayed-notification payment method** (`us_bank_account`
/ ACH, SEPA debit, any bank debit), `processing` stops being an edge case and
becomes the **normal** state of a fresh charge. Every classification rule above
must be verified before that change ships, or the first ACH top-up double
charges on its first retry. Treat that `payment_method_types` line as
load-bearing, not as configuration.

## Rules for adding a new charge path

1. **Nothing charges a card inside an HTTP request.** The only two callers of
   `chargeAdvertiserCardOffSession` are workers under singleton advisory locks
   (`sharePayment`, `stripe`). An endpoint may open/close a period and set
   `nextRunAt`; the worker does the money. Keep it that way — one writer means
   there is no charge race to survive in the first place.
2. **Do not fork the charger.** Add a `flow` to its `FLOWS` table instead; the
   tuple (`kind`, surcharge, `purpose`) must stay in one place or a call site
   will eventually combine the pieces inconsistently.
3. **Every Stripe money call passes a deterministic idempotency key.** No
   exceptions (see the known gap below).
4. **Freeze the request body per attempt.** The charger reuses an existing
   row's `uid` and amounts precisely so a retry is byte-identical. Same key +
   different body = `idempotency_error`, not a replay — which historically
   turned a crash-retry into a false decline and then a double charge. Never
   recompute an amount into an existing attempt.
5. **Stamp the PaymentIntent id on the row immediately after creation**, before
   anything else can fail. It is the durable link a later run uses to find the
   charge.
6. **Book the ledger and complete the row in one transaction**, and make the
   ledger ref idempotent so a re-run dedups instead of double-crediting.
7. **A new attempt counter needs a recovery pass** that is keyed on the
   *entity* (share, period), not on the attempt — so it still finds a charge
   placed under a key that has since rotated. `recoverPendingPaygCharges` is
   the model; note it runs **before** the shortfall is computed, so recovered
   money shrinks the next charge instead of being charged again.

### Stripe idempotency keys expire after 24 hours

The byte-stable-replay guarantee is not permanent. If a PaymentIntent is
created but its id-stamp write is lost, and the retry lands more than 24h later
(a long worker outage), the same key creates a genuinely new charge. Both retry
ladders are far shorter than 24h, so this is a tail risk rather than a live
one — but do not design a new flow whose retry window can exceed a day without
a Stripe-side lookup (search by `metadata.creditPurchaseUid`) first.

---

## Known gaps (2026-09-01 audit — not yet fixed)

Recorded so the rules above read as intent, not as a description of the current
code. Fixing these needs Matej's approval like any financial change.

1. **`chargeAdvertiserCardOffSession` create path classifies a non-terminal PI
   as a definitive decline.** After `paymentIntents.create`, any status that is
   not `succeeded` marks the row `FAILED` and throws `1337` — contradicting the
   retrieve path in the same file, which correctly treats `processing` /
   `requires_action` as `1342`. The result is a rotated key plus a row removed
   from both recovery nets. Unreachable today only because of the card-only
   pin above.
2. **The admin refund passes no Stripe idempotency key.**
   `controllers/v2/adminApp/creditPurchases/refundCreditPurchase.ts` calls
   `stripe.refunds.create` bare, and its lock ref is timestamped
   (`admin_refund_lock:{id}:{ISO}`), so it never dedups. Protection is entirely
   the `pendingLocked` accounting, which is read-then-write: two concurrent
   submits can both pass when available covers both. Fix is a client-supplied
   request id used for both the lock ref and the Stripe key.
3. **Unexpected errors are treated as declines.** Both callers route everything
   that is not `1342` to `handleDecline`, so a Prisma blip on the charger's
   pre-reads closes the PAYG period, emails "your card failed", and burns an
   attempt. No money risk (it throws before any Stripe call), but only `1337`
   should mean declined.

## Checklist before merging anything in this folder

- [ ] Every Stripe money call has a deterministic idempotency key
- [ ] Ambiguous outcomes defer; only a true refusal advances an attempt counter
- [ ] Non-terminal PI status → `1342`, row stays `PENDING`
- [ ] No `failOffSessionChargeRow` on a path where the charge might have collected
- [ ] The retried request body is byte-identical to the original
- [ ] Ledger booking + row completion share one transaction, on an idempotent ref
- [ ] Any new attempt counter has an entity-keyed recovery pass that runs first
- [ ] The charge still happens only in a worker, under its singleton lock
