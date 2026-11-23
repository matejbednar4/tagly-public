import prisma from "../../../prisma/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { stripeWorkerTunables as T } from "../../../constants/workers/STRIPE.js";
import { olderThan } from "../../helpers/olderThan.js";

/**
 * Shape the withdrawal reconciler needs. Everything reconciliation keys on lives
 * ON the row now (W-2/W-3): the connected account (`stripeAccountId`), the
 * `purpose` (rebuilds the deterministic idempotency keys), the settle marker, and
 * the payout leg — so a row is resolvable even after its customer was deleted by
 * an account-deletion sweep (`customerId` nulled via SetNull). We never resolve
 * the account through the customer row any more.
 */
const stuckWithdrawalSelect = {
  id: true,
  uid: true,
  customerId: true,
  amountCents: true,
  reversedCents: true,
  currency: true,
  purpose: true,
  stripeAccountId: true,
  stripeTransferId: true,
  stripePayoutId: true,
  payoutStatus: true,
  payoutAttempts: true,
  createdAt: true,
} satisfies Prisma.StripeWithdrawalSelect;

export type StuckWithdrawal = Prisma.StripeWithdrawalGetPayload<{
  select: typeof stuckWithdrawalSelect;
}>;

/**
 * W-3a / W-16 — PENDING withdrawals with **no transfer id** past the grace: the
 * transfer create (or its transferId persist) never landed, either from a crash
 * between the lock tx and the transfer, or from an ambiguous Stripe error where
 * the transfer may or may not exist. The balance is still locked and the intent
 * still valid; the worker lists Stripe and adopts-or-creates the transfer.
 */
export async function findWithdrawalsMissingTransfer(): Promise<
  StuckWithdrawal[]
> {
  const cutoff = olderThan(T.resolveMissingTransferAfterMs);
  return prisma.stripeWithdrawal.findMany({
    where: {
      status: "PENDING",
      stripeTransferId: null,
      createdAt: { lt: cutoff },
    },
    select: stuckWithdrawalSelect,
    orderBy: { createdAt: "asc" },
    take: T.batchSize,
  });
}

/**
 * W-3b — PENDING withdrawals whose transfer landed but whose WITHDRAWAL settle
 * event never committed (`settledAt` null). Left unsettled the lock is never
 * consumed (books overstate liabilities) and payout creation is (correctly)
 * blocked. The worker replays `createWithdrawalFromLocked` (idempotent on the
 * transfer id) + `recordSettled`.
 */
export async function findWithdrawalsNeedingSettle(): Promise<
  StuckWithdrawal[]
> {
  return prisma.stripeWithdrawal.findMany({
    where: {
      status: "PENDING",
      stripeTransferId: { not: null },
      settledAt: null,
      // A settle replays the ledger debit against the customer's locked balance,
      // so an orphaned (customer-deleted) row can never be settled by the worker.
      // Unreachable by construction (deleteCustomer can't run while a lock is
      // outstanding); excluded here so an impossible row can't cycle the pass
      // every 30s forever (the "never infinitely re-query" guarantee).
      customerId: { not: null },
    },
    select: stuckWithdrawalSelect,
    orderBy: { createdAt: "asc" },
    take: T.batchSize,
  });
}

/**
 * PENDING, settled withdrawals with **no payout yet** that are due — the inline
 * payout create in the request path didn't succeed (usually the transferred funds
 * weren't available on the account yet). The `settledAt` requirement is the W-3b
 * gate: we never pay out a row whose ledger debit hasn't settled.
 *
 * Due-ness (W-19/W-21): a fresh row (`payoutAttempts = 0`, `nextPayoutRetryAt`
 * null) is due once past the grace; after a create failure the transitions
 * schedule `nextPayoutRetryAt` (backoff for definitive rejections, short
 * recheck for ambiguous ones, Stripe's `available_on` for the attempt-free
 * W-21 funds-availability deferral) and the row is only due when it elapses. A
 * row parked at the attempts cap has `nextPayoutRetryAt = null` with
 * `attempts > 0` and matches neither branch — it waits for an account-fix
 * re-arm.
 */
export async function findWithdrawalsNeedingPayout(): Promise<
  StuckWithdrawal[]
> {
  const now = new Date();
  const cutoff = olderThan(T.createWithdrawalPayoutAfterMs);
  return prisma.stripeWithdrawal.findMany({
    where: {
      status: "PENDING",
      settledAt: { not: null },
      payoutStatus: "NONE",
      createdAt: { lt: cutoff },
      // Impossible by construction (`stripeAccountId` set at row creation since
      // the unified model; a settled row always has its transfer id — W-3b);
      // excluded so an inconsistent row can't cycle the pass forever. The
      // transfer id is what the payout denomination is derived from (W-20).
      stripeAccountId: { not: null },
      stripeTransferId: { not: null },
      OR: [
        { nextPayoutRetryAt: { lte: now } },
        { nextPayoutRetryAt: null, payoutAttempts: 0 },
      ],
    },
    select: stuckWithdrawalSelect,
    orderBy: { createdAt: "asc" },
    take: T.batchSize,
  });
}

/**
 * W-1 — PENDING withdrawals whose payout FAILED/CANCELED and are due for a retry
 * (`nextPayoutRetryAt` elapsed). Stripe returns failed payout funds to the
 * Connect balance and never retries a manual payout itself, so this pass
 * recreates it (amount = amountCents − reversedCents) under a fresh
 * attempt-numbered idempotency key.
 *
 * Eligibility is **`nextPayoutRetryAt` alone** — deliberately no attempts cap
 * here (D4 amendment). The `maxPayoutAttempts` cap governs *timed* rescheduling
 * only: `recordPayoutFailed/Canceled` stops setting `nextPayoutRetryAt` once
 * attempts are exhausted (row parks as DELAYED + ops email). An **event-driven
 * re-arm** — `account.updated` reporting payouts re-enabled, i.e. the customer
 * fixed their payout account — sets `nextPayoutRetryAt` even on an exhausted
 * row and is always honored: it grants exactly one more attempt per fix-event
 * (another failure re-parks + re-alerts).
 */
export async function findWithdrawalsToRetryPayout(): Promise<
  StuckWithdrawal[]
> {
  const now = new Date();
  return prisma.stripeWithdrawal.findMany({
    where: {
      status: "PENDING",
      payoutStatus: { in: ["FAILED", "CANCELED"] },
      nextPayoutRetryAt: { not: null, lte: now },
      // Impossible by construction (a FAILED/CANCELED payout implies the
      // transfer + settle landed); excluded so an inconsistent row can't
      // cycle the pass forever. The transfer id is what the payout
      // denomination is derived from (W-20).
      stripeAccountId: { not: null },
      stripeTransferId: { not: null },
    },
    select: stuckWithdrawalSelect,
    orderBy: { createdAt: "asc" },
    take: T.batchSize,
  });
}

/**
 * PENDING withdrawals with an IN_FLIGHT payout that should have resolved by now —
 * the missed-webhook backstop. Once a poll marks one PAID (→ COMPLETED) or
 * FAILED/CANCELED (→ DELAYED, retry-scheduled), its `payoutStatus` leaves
 * IN_FLIGHT and it drops out, so we never re-poll a resolved payout.
 */
export async function findWithdrawalsToPoll(): Promise<StuckWithdrawal[]> {
  const cutoff = olderThan(T.pollWithdrawalPayoutAfterMs);
  return prisma.stripeWithdrawal.findMany({
    where: {
      status: "PENDING",
      payoutStatus: "IN_FLIGHT",
      createdAt: { lt: cutoff },
      // IN_FLIGHT implies both exist (recordPayoutCreated); excluded so an
      // inconsistent row can't cycle the pass forever.
      stripeAccountId: { not: null },
      stripePayoutId: { not: null },
    },
    select: stuckWithdrawalSelect,
    orderBy: { createdAt: "asc" },
    take: T.batchSize,
  });
}
