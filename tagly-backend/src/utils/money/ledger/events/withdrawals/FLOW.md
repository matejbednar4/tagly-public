# Customer Withdrawal Flow

## Overview

Handles customer withdrawals from their earned balance to their Stripe Connect account. Uses a **lock -> transfer -> confirm** pattern with unlock/reversal safety nets.

## Events

### 1. `WITHDRAWAL_LOCK` — Reserve funds for withdrawal

- **File:** `lockBalanceForWithdrawal.ts`
- **Trigger:** Customer initiates withdrawal
- **Deltas:** `deltaCustomerCents: -amount`, `deltaCustomerLockedCents: +amount`
- **Idempotency:** `externalRef = withdraw:{customerId}:{withdrawalUid}:lock:v1`
- **Zero-sum:** Yes (available -> locked)
- **Overdraw guard (load-bearing):** the pre-check (`SELECT balance` + compare) and
  the debit inside `createLedgerEvent` are **not** atomic, so two withdrawals racing
  on the same balance could both pass the pre-check and both debit → negative
  balance. The decrementing `UPDATE` serializes on the customer row lock, so the
  lock step **re-reads the balance after the debit (same tx) and throws if it went
  negative**, rolling back the loser's event + `StripeWithdrawal` row. This is the
  single point where customer overdraw is prevented — keep it.

### 2. `WITHDRAWAL` — Execute Stripe transfer

- **File:** `createWithdrawalFromLocked.ts`
- **Trigger:** Stripe transfer created successfully
- **Deltas:** `deltaCustomerLockedCents: -amount`
- **Idempotency:** `externalRef = {stripeTransferId}` (dual check: also by `stripeWithdrawalId`)
- **Zero-sum:** No (funds leave system to customer's bank)
- **Note:** Validates sufficient locked balance before creating event

### 3. `WITHDRAWAL_UNLOCK` — Release lock on failed withdrawal

- **File:** `unlockBalanceForFailedWithdrawal.ts`
- **Trigger:** Stripe transfer fails
- **Deltas:** `deltaCustomerCents: +amount`, `deltaCustomerLockedCents: -amount`
- **Idempotency:** `externalRef = withdraw:{customerId}:{withdrawalUid}:unlock:v1`
- **Zero-sum:** Yes (locked -> available)

### 4. `WITHDRAWAL_REVERSAL` — Stripe claws back a transfer

- **File:** `reverseWithdrawalFromTransfer.ts`
- **Trigger:** Stripe `transfer.reversed` webhook
- **Deltas:** `deltaCustomerCents: +deltaToCredit` (incremental credit)
- **Idempotency:** `externalRef = withdraw:{customerId}:{stripeWithdrawalId}:reversal:{totalReversed}`
- **Zero-sum:** No (funds re-enter system from Stripe)
- **Note:** Supports partial reversals — encodes total reversed amount in `externalRef`, calculates incremental delta vs. already-credited amount. Only operates on PENDING withdrawals.

## Flow

### Happy path

```
Customer requests withdrawal
  |
  v
WITHDRAWAL_LOCK (available -> locked)
  |
  v
stripe.transfers.create()
  |
  v
WITHDRAWAL (locked -> out to bank)
```

### Transfer fails

```
WITHDRAWAL_LOCK (available -> locked)
  |
  v
stripe.transfers.create() -- fails
  |
  v
WITHDRAWAL_UNLOCK (locked -> available)
```

### Stripe reversal (after successful transfer)

```
WITHDRAWAL completed
  |
  v
Stripe fires transfer.reversed webhook
  |
  v
WITHDRAWAL_REVERSAL (+amount back to available)
```
