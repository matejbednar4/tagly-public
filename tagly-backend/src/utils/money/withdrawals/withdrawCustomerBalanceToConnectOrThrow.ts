import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../clients/stripe.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { reportError } from "../../core/errors/reportError.js";
import { generateUid } from "../../core/uids/generateUid.js";
import { lockBalanceForWithdrawal } from "../ledger/events/withdrawals/lockBalanceForWithdrawal.js";
import { unlockBalanceForFailedWithdrawal } from "../ledger/events/withdrawals/unlockBalanceForFailedWithdrawal.js";
import { createWithdrawalFromLocked } from "../ledger/events/withdrawals/createWithdrawalFromLocked.js";
import {
  createStandardWithdrawalPayoutOrThrow,
  isDefinitivePayoutCreateFailure,
  getPayoutFundsAvailableAt,
} from "./createStandardWithdrawalPayoutOrThrow.js";
import {
  recordTransferSucceeded,
  recordTransferFailed,
  recordSettled,
  recordPayoutCreateFailed,
  recordPayoutCreateDeferred,
} from "./withdrawalTransitions.js";
import {
  isDefinitiveStripeRejection,
  stripeErrorFailureFields,
} from "../stripe/stripeErrorClassification.js";
import {
  toDbWithdrawalPurpose,
  type WithdrawalPurposeWire,
} from "./withdrawalPurpose.js";
import Stripe from "stripe";

/**
 * Cash out a customer's Tagly balance to their Stripe Connect account, as a
 * **platform-managed standard payout**. Shared by the withdrawal controller and
 * the account-deletion sweep so every withdrawal gets a manual, reconciled
 * payout. Instant was dropped — CZ can't use it
 * and it complicated the fee/balance handling.
 *
 * Flow:
 * 1. Ensure the connected account is on a `manual` payout schedule (idempotent —
 *    covers accounts created before manual became the default). Stripe then never
 *    auto-pays; we own every payout, so each carries our metadata and reconciles.
 *    This runs **before** any ledger write, so if it fails we throw with zero side
 *    effects (W-13/D6): a legacy auto-schedule account we couldn't confirm manual
 *    could otherwise auto-sweep the funds untagged alongside our tracked payout.
 * 2. Lock the funds in the customer balance (ledger event).
 * 3. Create a Stripe Transfer moving the funds to the connected account. On a
 *    **definitive** rejection (Stripe rejected the request — nothing moved),
 *    release the lock and mark the withdrawal FAILED. On an **ambiguous** error
 *    (timeout / connection drop / 5xx — the transfer may exist, only the response
 *    was lost, W-16), leave the row PENDING (balance stays locked, no transferId)
 *    and return `transfer: null`; the worker's missing-transfer pass then lists →
 *    adopts-or-creates the transfer deterministically (D5).
 * 4. Persist the transferId and settle the ledger (lock → withdrawal debit).
 * 5. Create the standard payout to the bank **inline, best-effort**. When the
 *    transferred funds aren't available on the account yet — the expected first
 *    outcome on CZ/FX accounts — the payout util's W-21 gate throws before
 *    `payouts.create` and the retry is scheduled for Stripe's `available_on`
 *    without consuming an attempt (`recordPayoutCreateDeferred`; not reported —
 *    normal flow). A real create failure is recorded exactly like the worker's
 *    W-19 handling (attempt count, retry schedule, latest failure code). Either
 *    way the row is left PENDING with no payoutId; the stripe reconciliation
 *    worker creates the payout on a later tick. Payout success/failure then
 *    settles via the `payout.paid` / `payout.failed` webhooks (with the worker
 *    as a backstop). The payout is denominated in the connected account's own
 *    currency (W-20 — see `createStandardWithdrawalPayoutOrThrow`), never the
 *    USD ledger figures.
 *
 * `transfer` in the result is `null` **only** in the ambiguous-error case above —
 * the withdrawal is genuinely in flight (still PENDING / PROCESSING) and the
 * caller must treat it as accepted, not failed (the sweep caller specifically must
 * not delete the customer until it settles).
 */
export async function withdrawCustomerBalanceToConnectOrThrow(params: {
  customerId: number;
  amountCents: number | bigint;
  currency: string; // "usd"
  purpose: WithdrawalPurposeWire;
  requirePayoutsEnabledAt: boolean;
}): Promise<{
  stripeAccountId: string;
  withdrawalId: number;
  withdrawalUid: string;
  transfer: Stripe.Transfer | null;
  payout: Stripe.Payout | null;
}> {
  const {
    customerId,
    amountCents,
    currency,
    purpose,
    requirePayoutsEnabledAt,
  } = params;

  const amountBigInt =
    typeof amountCents === "bigint" ? amountCents : BigInt(amountCents);

  if (amountBigInt <= 0n) {
    throw createCustomError(1720, "invalid amount", 400);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      sensitiveData: {
        select: {
          stripeConnectId: true,
          payoutsEnabledAt: true,
        },
      },
    },
  });

  if (!customer) {
    throw createCustomError(1711, "customer not found", 404);
  }

  const stripeAccountId = customer.sensitiveData?.stripeConnectId;
  if (!stripeAccountId) {
    throw createCustomError(1712, "stripe account not connected", 409);
  }

  if (requirePayoutsEnabledAt && !customer.sensitiveData?.payoutsEnabledAt) {
    throw createCustomError(1716, "payouts not enabled yet", 409);
  }

  // Ensure the connected account is platform-controlled (manual). New v2 accounts
  // are created manual; this converts any pre-existing account on its first v2
  // withdrawal — it stops Stripe from *also* auto-paying (untagged) alongside our
  // tracked payout. Idempotent (no-op when already manual). Runs BEFORE any ledger
  // write, so throwing here has zero side effects and the user simply retries
  // (W-13/D6): swallowing the failure on a legacy auto-schedule account would let
  // Stripe auto-sweep the funds untagged, our payout then fail on insufficient
  // funds, and the row stick at DELAYED while the customer was actually paid.
  try {
    await stripe.accounts.update(stripeAccountId, {
      settings: { payouts: { schedule: { interval: "manual" } } },
    });
  } catch (err) {
    // Root cause (the Stripe error) rides to the tracker via `cause`; the client
    // sees only the generic message.
    throw createCustomError(1717, "could not confirm payout account", {
      status: 502,
      cause: err,
    });
  }

  // Persist the connected account + purpose ON the row so reconciliation is
  // self-sufficient (the customer row can be nulled by a deletion sweep, and the
  // deterministic idempotency keys are rebuilt from the purpose).
  const purposeEnum = toDbWithdrawalPurpose(purpose);

  const { withdrawal, lockResult } = await prisma.$transaction(async (tx) => {
    const uid = generateUid("WITHDRAWAL");

    const created = await tx.stripeWithdrawal.create({
      data: {
        uid,
        customerId,
        amountCents: amountBigInt,
        currency,
        status: "PENDING",
        stripeAccountId,
        purpose: purposeEnum,
      },
    });

    const lr = await lockBalanceForWithdrawal(tx, {
      customerId,
      amountCents: Number(amountBigInt.toString()),
      withdrawalUid: uid,
      stripeWithdrawalId: created.id,
      meta: { withdrawalId: created.id, purpose },
    });

    return { withdrawal: created, lockResult: lr };
  });

  let transfer: Stripe.Transfer;
  try {
    const idempotencyKey = `withdraw:${withdrawal.uid}:transfer:${purpose}:v1`;

    transfer = await stripe.transfers.create(
      {
        amount: Number(lockResult.lockCents.toString()),
        currency,
        destination: stripeAccountId,
        // Only the uid + purpose go to Stripe — internal numeric DB ids are
        // never leaked to (or read back from) Stripe (W-10).
        metadata: {
          withdrawalUid: withdrawal.uid,
          purpose,
        },
      },
      { idempotencyKey },
    );
  } catch (err: any) {
    const { failureCode, failureMessage } = stripeErrorFailureFields(
      err,
      "stripe_transfer_failed",
    );

    // W-16: only a DEFINITIVE rejection means the transfer certainly never
    // happened, so only then is it safe to unlock the balance and terminate the
    // row FAILED. An ambiguous error (timeout / connection drop / Stripe 5xx /
    // anything we can't classify) may have created the transfer with only the
    // response lost — unlocking would strand the funds on the Connect account
    // while the books say nothing left. For those we keep the row PENDING (still
    // locked, no transferId) and return PROCESSING; the worker's missing-transfer
    // pass lists Stripe and adopts-or-creates the transfer deterministically.
    // (Classification is shared with that worker pass — W-17.)
    if (!isDefinitiveStripeRejection(err)) {
      // Ambiguous Stripe error — self-heals via the worker's missing-transfer
      // pass. Tracked (no notify) so the rate is visible.
      reportError(err, {
        source: "api",
        errorClass: "unexpected",
        service: "withdrawals",
        withdrawalUid: withdrawal.uid,
        phase: "transfer-ambiguous",
      });
      return {
        stripeAccountId,
        withdrawalId: withdrawal.id,
        withdrawalUid: withdrawal.uid,
        transfer: null,
        payout: null,
      };
    }

    await prisma.$transaction(async (tx) => {
      await unlockBalanceForFailedWithdrawal(tx, {
        customerId,
        amountCents: lockResult.lockCents,
        withdrawalUid: withdrawal.uid,
        reason: "stripe_transfer_failed",
        lockLedgerEventId: lockResult.event.id,
        stripeWithdrawalId: withdrawal.id,
      });

      await recordTransferFailed(tx, {
        withdrawalId: withdrawal.id,
        failureCode,
        failureMessage,
      });
    });

    throw createCustomError(1713, "withdrawal failed", 502);
  }

  // Persist the Stripe transferId immediately, outside any transaction, so the
  // StripeWithdrawal row is recoverable if the settle ledger event below fails
  // to commit. Without this write, a Stripe-succeeded transfer whose settle tx
  // fails would leave the row PENDING with no stripeTransferId, the customer's
  // balance still locked, and no way to know which Stripe transfer it
  // corresponds to. With it, a stuck row is identifiable (PENDING + has
  // transferId + no WITHDRAWAL ledger event) and recoverable by replaying
  // createWithdrawalFromLocked (idempotent on externalRef = transferId).
  await recordTransferSucceeded(prisma, {
    withdrawalId: withdrawal.id,
    transferId: transfer.id,
  });

  await prisma.$transaction(async (tx) => {
    await createWithdrawalFromLocked(tx, {
      customerId,
      amountCents: transfer.amount,
      transferId: transfer.id,
      stripeWithdrawalId: withdrawal.id,
      meta: {
        withdrawalId: withdrawal.id,
        withdrawalUid: withdrawal.uid,
        stripeAccountId,
        purpose,
      },
    });

    // Mark the row settled atomically with the WITHDRAWAL settle event, so the
    // worker can never see a settled ledger without a settledAt marker (gates
    // the needs-payout / needs-settle reconciliation passes).
    await recordSettled(tx, { withdrawalId: withdrawal.id });
  });

  // Create the payout to the bank inline (best-effort). The debit is already
  // settled, so if this fails — most likely the transferred funds aren't yet
  // available on the connected account — we leave the row PENDING with no
  // payoutId and the stripe worker creates the payout on a later tick. The shared
  // helper uses a deterministic idempotency key, so an inline+worker overlap can
  // never produce two payouts.
  let payout: Stripe.Payout | null = null;
  try {
    payout = await createStandardWithdrawalPayoutOrThrow({
      stripeWithdrawalId: withdrawal.id,
      withdrawalUid: withdrawal.uid,
      stripeAccountId,
      stripeTransferId: transfer.id,
      purpose,
    });
  } catch (err) {
    const fundsAvailableAt = getPayoutFundsAvailableAt(err);
    if (fundsAvailableAt) {
      // W-21: the transferred funds are still `pending` on the connected
      // account — the EXPECTED first outcome for any account whose transfers
      // don't settle instantly (every CZ/FX account; availability is
      // typically T+1). Schedule the payout for Stripe's availability date
      // without consuming an attempt, and don't report — this is normal flow,
      // not an error. Best-effort like the W-19 leg below: an unrecorded
      // deferral just means the row matches the needs-payout pass's fresh-row
      // branch after the grace, and the worker re-derives the same deferral.
      await recordPayoutCreateDeferred(prisma, {
        withdrawalId: withdrawal.id,
        fundsAvailableAt,
      }).catch((recordErr) => {
        reportError(recordErr, {
          source: "api",
          errorClass: "unexpected",
          service: "withdrawals",
          withdrawalUid: withdrawal.uid,
          phase: "inline-payout-defer-record",
        });
      });
    } else {
      // Inline payout create failed — record it exactly like the worker's W-19
      // handler (attempt count + retry schedule + latest failure code), so the
      // row state is truthful regardless of which path hit the failure; the
      // worker then self-heals it on schedule. Exhaustion is unreachable here
      // (always the row's first attempt, and maxPayoutAttempts > 1), so there is
      // no ops-alert leg. Recording is itself best-effort: if the DB write fails,
      // the row still matches the needs-payout pass's fresh-row branch after the
      // grace, which is exactly the pre-recording behavior. Tracked (no notify).
      const { failureCode, failureMessage } = stripeErrorFailureFields(
        err,
        "payout_create_failed",
      );
      await recordPayoutCreateFailed(prisma, {
        withdrawalId: withdrawal.id,
        definitive: isDefinitivePayoutCreateFailure(err),
        failureCode,
        failureMessage,
      }).catch((recordErr) => {
        reportError(recordErr, {
          source: "api",
          errorClass: "unexpected",
          service: "withdrawals",
          withdrawalUid: withdrawal.uid,
          phase: "inline-payout-create-record",
        });
      });
      reportError(err, {
        source: "api",
        errorClass: "unexpected",
        service: "withdrawals",
        withdrawalUid: withdrawal.uid,
        phase: "inline-payout-create",
      });
    }
  }

  return {
    stripeAccountId,
    withdrawalId: withdrawal.id,
    withdrawalUid: withdrawal.uid,
    transfer,
    payout,
  };
}
