import Stripe from "stripe";
import { stripe } from "../../clients/stripe.js";
import prisma from "../../../prisma/prisma.js";
import {
  createCustomError,
  isCustomError,
} from "../../core/errors/createCustomError.js";
import { isDefinitiveStripeRejection } from "../stripe/stripeErrorClassification.js";
import { recordPayoutCreated } from "./withdrawalTransitions.js";
import type { WithdrawalPurposeWire } from "./withdrawalPurpose.js";

/**
 * Create the **standard** Stripe payout that moves a withdrawal's funds from the
 * customer's connected account to their bank, and record its id on the row.
 *
 * This is the single place a withdrawal payout is created, shared by three
 * callers:
 *  - the withdrawal request path (`withdrawCustomerBalanceToConnectOrThrow`),
 *    inline right after the transfer,
 *  - the stripe reconciliation worker's create-missing pass, which retries any
 *    PENDING withdrawal whose inline create didn't land, and
 *  - the worker's W-1 retry pass, after a created payout terminally failed.
 *
 * **Denomination (W-20).** The payout amount and currency are derived from what
 * the transfer ACTUALLY became on the connected account, never from the USD
 * ledger figures. A non-USD account settles the transfer in its own currency
 * (Stripe FX, minus the conversion fee), so the ledger's `amountCents`/
 * `currency` describe a balance that doesn't exist there — requesting them
 * produced a guaranteed `balance_insufficient` on every CZ withdrawal (the
 * pre-launch CZ payout bug). The transfer's destination payment's balance
 * transaction is Stripe's record of the landed funds: its `net` in its
 * `currency` is exactly what this transfer made payable, and subtracting the
 * payment's `amount_refunded` (transfer reversals surface as refunds on the
 * destination payment, in the account currency) keeps a partially-reversed row
 * payable without lossy USD→account-currency math (E033). On a USD account this
 * derives exactly the transfer's own amount/currency (same-currency transfers
 * have no FX and no fee), so the US path is value-identical to the pre-W-20
 * behavior. The derived figure is intentionally NOT persisted — the ledger and
 * the `StripeWithdrawal` row stay USD-only; Stripe's payout object (whose id we
 * store) is the durable record of the account-currency amount. The customer
 * absorbs Stripe's FX fee (approved policy 2026-08-07): the net is the only
 * amount guaranteed available.
 *
 * All callers pass the **same deterministic `idempotencyKey`** (derived from the
 * withdrawal uid + `attemptKey`), which is the safety mechanism: if the inline
 * create already succeeded but its DB write was lost, the worker's call returns
 * the *same* payout instead of creating a second one — so a withdrawal is never
 * paid out twice. The first payout (inline + worker create-pass) uses the
 * default `"v1"` attempt key; each W-1 retry passes its attempt number instead,
 * so a retry deliberately rotates the key to create a genuinely new payout after
 * the previous one terminally failed.
 *
 * The account must be on a `manual` payout schedule (the v2 flow guarantees
 * this) so this payout is the only one that ever moves these funds. Payouts are
 * always standard (free); instant was dropped in v2. Throws on Stripe failure —
 * the caller decides whether to swallow (inline) or retry next tick (worker).
 * Derivation failures throw `{ permanent: true }` `CustomError`s: they occur
 * BEFORE `payouts.create` is called, so no payout can exist and they classify
 * as definitive (see `isDefinitivePayoutCreateFailure`).
 *
 * **W-21 funds-availability gate.** Funds a transfer lands on the connected
 * account are `pending` until Stripe's `available_on` (T+1 typically; longer
 * for cross-border FX), and a payout created before then is a guaranteed
 * `balance_insufficient`. The gate checks the balance transaction's `status`
 * and throws the typed 1723 deferral error (with `available_on` attached — see
 * `getPayoutFundsAvailableAt`) BEFORE `payouts.create`, so no attempt is
 * consumed, no idempotency key is burned with a cached error, and the call
 * sites schedule the retry against Stripe's own availability date
 * (`recordPayoutCreateDeferred`) instead of the blind W-19 backoff.
 */
export async function createStandardWithdrawalPayoutOrThrow(params: {
  stripeWithdrawalId: number;
  withdrawalUid: string;
  stripeAccountId: string;
  stripeTransferId: string;
  purpose: WithdrawalPurposeWire;
  /**
   * Idempotency-key discriminator for this payout attempt. Defaults to `"v1"`
   * (the first payout, shared by the inline create and the worker create-pass).
   * A W-1 retry passes its attempt number so the key rotates to a new payout.
   */
  attemptKey?: string;
}): Promise<Stripe.Payout> {
  const {
    stripeWithdrawalId,
    withdrawalUid,
    stripeAccountId,
    stripeTransferId,
    purpose,
    attemptKey = "v1",
  } = params;

  const transfer = await stripe.transfers.retrieve(stripeTransferId);
  const destinationPaymentId =
    typeof transfer.destination_payment === "string"
      ? transfer.destination_payment
      : transfer.destination_payment?.id;
  if (!destinationPaymentId) {
    // Impossible for a succeeded transfer; permanent ⇒ definitive (no payout
    // was created), so the failure handler counts the attempt and backs off
    // instead of looping on the ambiguous short recheck.
    throw createCustomError(1721, "transfer has no destination payment", {
      permanent: true,
      cause: { stripeTransferId },
    });
  }

  const payment = await stripe.charges.retrieve(
    destinationPaymentId,
    { expand: ["balance_transaction"] },
    { stripeAccount: stripeAccountId },
  );
  const balanceTxn = payment.balance_transaction;
  if (!balanceTxn || typeof balanceTxn === "string") {
    throw createCustomError(
      1721,
      "destination payment has no balance transaction",
      { permanent: true, cause: { stripeTransferId, destinationPaymentId } },
    );
  }

  // What this transfer made payable on the account, in the account's currency:
  // the landed net minus everything reversals already clawed back (refunds on
  // the destination payment are denominated in the account currency).
  const amount = balanceTxn.net - payment.amount_refunded;
  if (amount <= 0) {
    // Reversals consumed everything that landed — no payout from this transfer
    // can ever succeed. Definitive: backoff → park + D4 alert at the cap.
    throw createCustomError(1722, "nothing payable on the connected account", {
      permanent: true,
    });
  }

  // W-21: the transfer landed but its funds are still `pending` on the
  // connected account. `payouts.create` would be a guaranteed
  // `balance_insufficient`, and under plain W-19 each one burned a real
  // attempt — five doomed attempts across ~15h exhausted the ladder before
  // the money was even payable (wd-G1oqVLiCo, 2026-08-11). Throw the typed
  // deferral BEFORE the create call instead: attempt-free, key-safe (no
  // cached error to replay on the unburned idempotency key), and carrying
  // `available_on` so the caller schedules the retry against Stripe's own
  // availability date. Checked AFTER the amount guard so a fully-reversed row
  // still reaches its terminal 1722 verdict instead of deferring forever.
  if (balanceTxn.status !== "available") {
    const availableOnMs = Number.isFinite(balanceTxn.available_on)
      ? balanceTxn.available_on * 1000
      : Date.now();
    throw createCustomError(
      1723,
      "transferred funds not yet available on the connected account",
      {
        // Expected operational state, not a failure — never tracked. NOT
        // `permanent`: that would classify as definitive and burn an attempt.
        expected: true,
        cause: { fundsAvailableAt: new Date(availableOnMs).toISOString() },
      },
    );
  }

  const idempotencyKey = `withdraw:${withdrawalUid}:payout:standard:${purpose}:${attemptKey}`;

  const payout = await stripe.payouts.create(
    {
      amount,
      currency: balanceTxn.currency,
      // Only the uid + purpose go to Stripe — internal numeric DB ids are never
      // leaked to (or read back from) Stripe (W-10: "Stripe only consumes uids").
      metadata: {
        withdrawalUid,
        purpose,
      },
    },
    {
      stripeAccount: stripeAccountId,
      idempotencyKey,
    },
  );

  // Record the payout id + IN_FLIGHT status (bumps payoutAttempts) so the
  // `payout.paid`/`payout.failed` webhooks and the worker's poll pass can find
  // this row, and so a re-run sees it's created.
  await recordPayoutCreated(prisma, {
    withdrawalId: stripeWithdrawalId,
    payoutId: payout.id,
  });

  return payout;
}

/**
 * Classify a thrown payout create for `recordPayoutCreateFailed`'s
 * `definitive` axis — shared by the worker's `handlePayoutCreateFailure` and
 * the inline catch in `withdrawCustomerBalanceToConnectOrThrow` so the two
 * sites can never drift.
 *
 * Definitive = the payout certainly does not exist: either Stripe refused the
 * create request outright (the shared W-17 split), or the throw is one of this
 * util's own `{ permanent: true }` derivation errors, which fire BEFORE
 * `payouts.create` is ever called. Everything else is ambiguous (the payout
 * may exist with only the response lost).
 */
export function isDefinitivePayoutCreateFailure(err: unknown): boolean {
  return (
    isDefinitiveStripeRejection(err) ||
    (isCustomError(err) && err.permanent === true)
  );
}

/**
 * Narrow a thrown payout create to the W-21 funds-availability deferral (1723)
 * and extract Stripe's `available_on` for scheduling. Returns `null` for every
 * other error, letting the caller fall through to the definitive/ambiguous
 * split — so call sites check this FIRST, before
 * `isDefinitivePayoutCreateFailure` (`handlePayoutCreateFailure` in the worker,
 * the inline catch in `withdrawCustomerBalanceToConnectOrThrow`).
 *
 * Safety of the fallthrough: a 1723 whose date is somehow missing/unparsable
 * returns `null` and lands in the AMBIGUOUS branch (1723 is neither a Stripe
 * rejection class nor `permanent`) — a short same-key recheck, still
 * attempt-free, so a degraded deferral can never burn the retry budget.
 */
export function getPayoutFundsAvailableAt(err: unknown): Date | null {
  if (!isCustomError(err) || err.error.code !== 1723) return null;
  const cause = (err as Error & { cause?: { fundsAvailableAt?: unknown } })
    .cause;
  const raw = cause?.fundsAvailableAt;
  if (typeof raw !== "string") return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
