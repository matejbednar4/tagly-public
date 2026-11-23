import prisma from "../../../prisma/prisma.js";
import { sharePaymentWorkerTunables as T } from "../../../constants/workers/SHARE_PAYMENT.js";
import {
  createCustomError,
  isCustomError,
} from "../../../utils/core/errors/createCustomError.js";
import { calculateFinalPrice } from "../../../utils/pricing/calculateFinalPrice.js";
import { settleSharePayoutAndUnlockRemainder } from "../../../utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.js";
import { settleSubsidizedSharePayout } from "../../../utils/money/ledger/events/sharePayment/settleSubsidizedSharePayout.js";
import { markShareUnpayableAndUnlock } from "../../../utils/shares/markShareUnpayableAndUnlock.js";
import {
  TransactionKind,
  ShareFundingMode,
} from "../../../generated/prisma/client.js";
import { reportWorkerError } from "../../runtime/reportWorkerError.js";
import { persistFinalPrice } from "./persistFinalPrice.js";
import {
  markSharePaidOrThrow,
  ShareNotProcessingError,
} from "./markSharePaidOrThrow.js";
import { settlePaygShare } from "./settlePaygShare.js";
import type { SharePaymentOutcome } from "./settlePaygShare.js";
export type { SharePaymentOutcome };

type ShareForPayment = {
  id: number;
  uid: string;
  customerId: number | null;
  advertiserId: number | null;
  localId: number | null;
  createdAt: Date;
  fundingModeAtCreation: ShareFundingMode;
  paygChargeAttempts: number | null;
};

/**
 * Executes payment for a share. Discriminates on the immutable
 * `fundingModeAtCreation`:
 *
 *   SUBSIDIZED → platform pays (settleSubsidizedSharePayout)
 *   CREDITS    → settle from the lock (settleSharePayoutAndUnlockRemainder)
 *   PAYG       → live, lock-less → settlePaygShare (charge the card; if available
 *                credits already cover it the card isn't touched, and if no card
 *                is on file the customer is still paid in full while the advertiser
 *                balance goes negative — see settlePaygShare)
 *
 * PAYG shares are always created lock-less, and nothing ever adds a SHARE_LOCK to
 * them afterwards: card removal closes the period but deliberately leaves in-flight
 * shares as-is (see removePaygPaymentMethod). So the SHARE_LOCK lookup below is a
 * defensive guard, not a live path — if a PAYG share somehow had a lock we settle
 * from it rather than double-charge the card.
 *
 * @returns "paid"      — customer paid, share PAID
 *          "deferred"  — retry pending: PAYG charge declined, or the settle hit a
 *                        TRANSIENT (non-domain) error; share stays PROCESSING with
 *                        a backed-off retry (every ledger write is idempotent)
 *          "unpayable" — permanent domain failure; share marked UNPAYABLE and any
 *                        lock returned
 *          "skipped"   — lost the PROCESSING → PAID claim to a concurrent void
 *                        (IG disconnect / account deletion); nothing settled here,
 *                        the void owner handled the terminal state + lock release
 */
export async function executeSharePayment(
  share: ShareForPayment,
): Promise<SharePaymentOutcome> {
  // Declared outside try so the catch block can use it for the correct unlock path.
  let wasSubsidizedAtCreation = false;

  try {
    if (!share.customerId || !share.localId) {
      // createCustomError → classified PERMANENT by the catch below (a missing
      // participant can't heal on retry).
      throw createCustomError(
        5240,
        `Share ${share.uid} missing required fields for payment: ` +
          `customerId=${share.customerId}, localId=${share.localId}`,
        500,
      );
    }

    // Subsidization is read from the immutable funding classification stamped
    // at creation — the canonical signal (see tagly-backend/CLAUDE.md §Subsidized
    // Share Invariant).
    wasSubsidizedAtCreation =
      share.fundingModeAtCreation === ShareFundingMode.SUBSIDIZED;

    // A share must be funded by either an advertiser or a subsidization period.
    if (!share.advertiserId && !wasSubsidizedAtCreation) {
      // createCustomError → classified PERMANENT by the catch below.
      throw createCustomError(
        5241,
        `Share ${share.uid} has no advertiserId and no subsidization period at creation — invalid state`,
        500,
      );
    }

    const priceResult = await calculateFinalPrice({
      shareId: share.id,
      wasSubsidizedAtCreation,
    });

    // SUBSIDIZED → platform pays.
    if (wasSubsidizedAtCreation) {
      await prisma.$transaction(async (tx) => {
        await markSharePaidOrThrow(tx, share.id);
        await persistFinalPrice(tx, share.id, priceResult);
        const settle = await settleSubsidizedSharePayout(tx, {
          customerId: priceResult.customerId,
          shareId: share.id,
          finalPriceCents: priceResult.finalPriceCents,
          meta: { algoVersion: priceResult.algoVersion },
        });
        // Record what the platform actually paid + why it was short, if it was
        // (subsidized shortfalls come from a low platform Stripe balance).
        await tx.finalPrice.update({
          where: { shareId: share.id },
          data: {
            settledGrossCents: settle.actualPaid,
            capReason: settle.shortfall > 0n ? "PLATFORM_BALANCE" : null,
          },
        });
      });
      return "paid";
    }

    // Non-subsidized: advertiserId is guaranteed non-null by the guard above.
    const advertiserId = share.advertiserId!;

    // PAYG is created lock-less and stays that way (card removal leaves in-flight
    // shares untouched; the no-card case is handled inside settlePaygShare), so in
    // practice there's never a lock here → settlePaygShare. The lookup is a
    // defensive guard: a PAYG share WITH a lock would be a bug, and settling from
    // the lock below is safer than double-charging the card.
    if (share.fundingModeAtCreation === ShareFundingMode.PAYG) {
      const lock = await prisma.transactionLedgerEvent.findFirst({
        where: {
          shareId: share.id,
          advertiserId,
          kind: TransactionKind.SHARE_LOCK,
        },
        select: { id: true },
      });
      if (!lock) {
        return await settlePaygShare(
          {
            id: share.id,
            uid: share.uid,
            advertiserId,
            paygChargeAttempts: share.paygChargeAttempts,
          },
          priceResult,
        );
      }
    }

    // CREDITS (or the defensive PAYG-with-lock case above) → settle from the lock,
    // topping up from available IN FULL — past zero if needed (negative available
    // = advertiser receivable; policy in settleSharePayoutAndUnlockRemainder's
    // docblock). A lock-less CREDITS share trips settle's 1608 → caught below →
    // UNPAYABLE (a bug signal).
    await prisma.$transaction(async (tx) => {
      await markSharePaidOrThrow(tx, share.id);
      await persistFinalPrice(tx, share.id, priceResult);
      const settle = await settleSharePayoutAndUnlockRemainder(tx, {
        advertiserId,
        shareId: share.id,
        grossPriceCents: priceResult.finalPriceCents,
        customerId: priceResult.customerId,
        meta: { algoVersion: priceResult.algoVersion },
      });
      // settledGross always equals the algo final now (paid in full); capReason
      // stays stamped for the settle contract (always null on this path).
      await tx.finalPrice.update({
        where: { shareId: share.id },
        data: {
          settledGrossCents: settle.actualGrossPaid,
          capReason: settle.capReason,
        },
      });
    });

    return "paid";
  } catch (error) {
    // Lost the PROCESSING → PAID claim: a concurrent void owns the terminal
    // state and already released any lock. Nothing was settled (the tx rolled
    // back) — back off without touching the share or the ledger.
    if (error instanceof ShareNotProcessingError) {
      return "skipped";
    }

    const message = (error as Error)?.message ?? String(error);
    // Route through the single observability chokepoint (PostHog + admin
    // dashboard get wired here per v2.0.0.md §5). Report before any DB write so
    // the original error is always captured even if the follow-up throws.
    // Ledger-flow violations (16xx) are money-integrity invariant breaks →
    // escalate; pricing invariants / transient blips just track.
    const code = isCustomError(error) ? error.error.code : undefined;
    const isLedgerFlowViolation = code != null && code >= 1600 && code <= 1699;
    reportWorkerError(error, {
      worker: "sharePayment",
      phase: "job",
      shareId: share.id,
      shareUid: share.uid,
      ...(isLedgerFlowViolation
        ? { notify: true, notifyKey: `share-ledger-flow-violation:${share.id}` }
        : {}),
    });

    // Only PERMANENT failures void the share — the deliberate domain throws
    // (createCustomError: pricing invariants 5004/5235, ledger flow violations
    // 16xx, the 5240/5241 guards above). Anything else (DB hiccup, Stripe
    // timeout, network) is presumed TRANSIENT: every ledger write is idempotent,
    // so the share is deferred and re-settled after a backoff instead of being
    // terminally voided by a blip.
    if (!isCustomError(error)) {
      await prisma.share
        .update({
          where: { id: share.id },
          data: {
            paygNextRetryAt: new Date(Date.now() + T.transientRetryBackoffMs),
            // Persist the failure so admins can see why this share is deferring.
            lastProcessingError: message,
            lastProcessingErrorAt: new Date(),
          },
        })
        .catch(() => {}); // worst case: no backoff, re-picked next tick
      return "deferred";
    }

    // Void the share and release whatever pool it locked, through the single
    // shared implementation: a CAS-guarded PROCESSING → UNPAYABLE flip plus the
    // correct-pool unlock read from the SHARE_LOCK event (not the funding mode).
    // If a concurrent void already terminated the share it flips nothing and
    // unlocks nothing, so we never double-release. `message` rides through to
    // `lastProcessingError` so admins can see why without grepping logs; the
    // user-facing classification is SETTLEMENT_FAILED (the raw settle error
    // must never reach a client).
    await prisma.$transaction(async (tx) => {
      await markShareUnpayableAndUnlock(tx, {
        shareId: share.id,
        reason: "SETTLEMENT_FAILED",
        detail: message,
      });
    });

    return "unpayable";
  }
}
