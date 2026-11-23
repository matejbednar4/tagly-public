# Credit Purchase & Refund Flow

## Overview

Handles advertiser credit purchases (deposits) and refunds. Refunds always follow a **lock -> refund** pattern regardless of whether initiated by admin or Stripe webhook.

## Events

### 1. `CREDIT_PURCHASE` — Advertiser buys credits

- **File:** `createAdvertiserCreditPurchaseEvent.ts`
- **Trigger:** Stripe `payment_intent.succeeded` webhook
- **Deltas:** `deltaAdvertiserCents: +amount`
- **Idempotency:** `externalRef = stripePaymentIntentId`

### 2. `CREDIT_PURCHASE_REFUND_LOCK` — Reserve funds for refund

- **File:** `lockBudgetForCreditPurchaseRefund.ts`
- **Trigger:** Admin initiates refund, or auto-created by `refundAdvertiserCreditPurchase` during webhook
- **Deltas:** `deltaAdvertiserCents: -amount`, `deltaAdvertiserLockedCents: +amount`
- **Idempotency:** `externalRef` provided by caller
- **Zero-sum:** Yes (available -> locked)
- **Note:** `requireSufficientAvailable` param — `true` for admin flows, `false` for webhook flows (money already left Stripe)

### 3. `CREDIT_PURCHASE_REFUND` — Confirm refund from locked budget

- **File:** `refundAdvertiserCreditPurchase.ts`
- **Trigger:** Stripe `refund.succeeded` webhook via `handleRefundEvent.ts`, or a
  LOST chargeback via `handleDisputeEvent.ts` (E066)
- **Deltas:** `deltaAdvertiserLockedCents: -amount`
- **Idempotency:** `externalRef = stripe_dispute_{disputeId}` (chargeback) >
  `stripe_refund_{refundId}` > `credit_purchase_refund_{paymentIntentId}` — a
  dispute clawback and a regular refund of the same purchase can never collide
- **Zero-sum:** No (funds leave system)
- **Note:** Auto-creates a lock event if none exists (webhook-only refunds /
  disputes, `enforceBalance=false` — the advertiser may go negative, the
  receivable model)

### 4. `CREDIT_PURCHASE_REFUND_UNLOCK` — Release lock on failed refund

- **File:** `unlockBudgetForFailedCreditPurchaseRefund.ts`
- **Trigger:** Stripe refund API call fails **definitively** in the admin
  controller (`isDefinitiveStripeRejection` — an ambiguous failure keeps the
  lock and pages a human instead, because the refund may exist and its webhook
  consumes this very lock; E021)
- **Deltas:** `deltaAdvertiserLockedCents: -amount`, `deltaAdvertiserCents: +amount`
- **Idempotency:** `externalRef` provided by caller
- **Zero-sum:** Yes (locked -> available)
- **Invariant:** the unlock is CAPPED at the purchase's recomputed pending lock
  (`getPendingLockedAmount`) and SKIPPED (`event: null`) when the webhook
  already consumed it — a blind unlock after the webhook books the refund is a
  platform-funded double credit (E021)

## Flows

### Admin-initiated refund

```
Admin selects credit purchase + amount
  |
  v
CREDIT_PURCHASE_REFUND_LOCK (available -> locked)
  |
  v
stripe.refunds.create()
  |
  +-- success ------------> Stripe fires refund.succeeded webhook
  |                           |
  |                           v
  |                         CREDIT_PURCHASE_REFUND (locked -> out)
  |
  +-- DEFINITIVE failure --> CREDIT_PURCHASE_REFUND_UNLOCK (locked -> available,
  |                          capped at the recomputed pending lock)
  |
  +-- AMBIGUOUS failure ---> lock KEPT + notify alert (4981). The refund may
                             exist: its webhook consumes the lock; if it truly
                             failed, a human resolves the alerted stuck lock.
```

### Stripe dashboard refund (webhook-only)

```
Stripe fires refund.succeeded webhook
  |
  v
refundAdvertiserCreditPurchase() detects no prior lock
  |
  v
Auto-creates CREDIT_PURCHASE_REFUND_LOCK (available -> locked, enforceBalance=false)
  |
  v
CREDIT_PURCHASE_REFUND (locked -> out)
```

### Chargeback (`charge.dispute.*`, E066 — handleDisputeEvent.ts)

```
charge.dispute.created ──> team alert only (Stripe already pulled amount + fee
  |                        from the platform balance; funds return if won)
  v
charge.dispute.closed
  |
  +-- lost --> CREDIT_PURCHASE_REFUND under stripe_dispute_{id}
  |            (auto-lock, enforceBalance=false -> advertiser may go negative)
  |            + purchase status recalc + team alert.
  |            The dispute FEE is a platform cost — never booked to the advertiser.
  |
  +-- won / other --> team alert only, nothing booked
```

Unmatched/currency-mismatched disputes alert + ACK (retries can never make them
bookable). ⚠️ Inert until `charge.dispute.created` + `charge.dispute.closed` are
subscribed on the Stripe platform webhook endpoints (prod + staging).

### Standard credit purchase

```
Advertiser pays via Stripe Checkout
  |
  v
Stripe fires payment_intent.succeeded webhook
  |
  v
CREDIT_PURCHASE (+amount to available)
```
