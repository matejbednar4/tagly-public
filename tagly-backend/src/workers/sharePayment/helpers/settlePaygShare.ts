import prisma from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { calculateFinalPrice } from "../../../utils/pricing/calculateFinalPrice.js";
import { stripe } from "../../../utils/clients/stripe.js";
import { isCustomError } from "../../../utils/core/errors/createCustomError.js";
import { chargeAdvertiserCardOffSession } from "../../../utils/money/stripe/chargeAdvertiserCardOffSession.js";
import {
  completeOffSessionChargeRow,
  failOffSessionChargeRow,
} from "../../../utils/money/stripe/offSessionChargeRow.js";
import { createPaygChargeEvent } from "../../../utils/money/ledger/events/payg/createPaygChargeEvent.js";
import { settleSharePayoutAndUnlockRemainder } from "../../../utils/money/ledger/events/sharePayment/settleSharePayoutAndUnlockRemainder.js";
import { closePaygPeriod } from "../../../utils/money/payg/closePaygPeriod.js";
import { queueNotificationJobs } from "../../../utils/queue/queueNotificationJobs.js";
import { persistFinalPrice } from "./persistFinalPrice.js";
import {
  markSharePaidOrThrow,
  ShareNotProcessingError,
} from "./markSharePaidOrThrow.js";
import { PAYG_SETTLEMENT } from "../../../constants/billing/PAYG.js";
import { chargeRetryBackoffMs } from "../../../utils/money/stripe/chargeRetryBackoffMs.js";
import { reportWorkerError } from "../../runtime/reportWorkerError.js";

/**
 * Settlement outcome — `deferred` = awaiting a backed-off retry (PAYG decline or
 * transient settle error); `skipped` = lost the PROCESSING → PAID claim to a
 * concurrent void (nothing settled; the void owner handled the terminal state).
 */
export type SharePaymentOutcome = "paid" | "unpayable" | "deferred" | "skipped";

type PriceResult = Awaited<ReturnType<typeof calculateFinalPrice>>;

type PaygShare = {
  id: number;
  uid: string;
  advertiserId: number;
  paygChargeAttempts: number | null;
};

/**
 * The per-(share, attempt) charge identity — used as BOTH the Stripe
 * idempotency key AND `StripeCreditPurchase.externalRef`, so the DB row and the
 * Stripe request are 1:1 and a retry can always find the exact charge a prior
 * run may have placed.
 */
const attemptChargeKey = (shareId: number, attemptNo: number) =>
  `payg-share:${shareId}:attempt:${attemptNo}:v1`;

/**
 * Ledger externalRef for booking attempt N's charge. Per-ATTEMPT (the old
 * per-share `payg-share:{id}:charge:v1` made a legitimate second collected
 * charge unbookable in principle); shared by the normal post-charge booking,
 * the voided-share recovery block, and the pre-pass below, so whichever path
 * books a given charge first wins and the others dedup on (externalRef, kind).
 */
const attemptChargeLedgerRef = (shareId: number, attemptNo: number) =>
  `payg-share:${shareId}:attempt:${attemptNo}:charge:v1`;

const parseAttemptFromRef = (ref: string): number | null => {
  const m = /^payg-share:\d+:attempt:(\d+):v1$/.exec(ref);
  return m ? Number(m[1]) : null;
};

/** Book a recovered succeeded charge to the advertiser's available balance. */
async function bookRecoveredCharge(
  share: PaygShare,
  row: {
    id: number;
    externalRef: string;
    amountCents: bigint;
    paygSurchargeCents: bigint | null;
  },
  pi: { id: string; latest_charge: unknown },
  attemptNo: number,
) {
  const effectiveCents = row.amountCents - (row.paygSurchargeCents ?? 0n);
  const latestCharge = pi.latest_charge;
  const chargeId =
    typeof latestCharge === "string"
      ? latestCharge
      : ((latestCharge as { id?: string } | null)?.id ?? null);

  await prisma.$transaction(async (tx) => {
    // Idempotent on (externalRef, kind) — a re-run or a racing normal-path
    // booking of the same charge dedups here.
    await createPaygChargeEvent(tx, {
      advertiserId: share.advertiserId,
      deltaAdvertiserCents: effectiveCents,
      shareId: share.id,
      externalRef: attemptChargeLedgerRef(share.id, attemptNo),
      stripeCreditPurchaseId: row.id,
      meta: {
        paymentIntentId: pi.id,
        note: "recovered by settle pre-pass (charge collected on a prior run that failed before booking)",
      },
    });
    await completeOffSessionChargeRow(tx, {
      stripeCreditPurchaseId: row.id,
      paymentIntentId: pi.id,
      chargeId,
    });
  });
}

/**
 * Recovery pre-pass: before deciding whether to charge, resolve any PENDING
 * PAYG charge row this share left behind on a previous run (crash or settle
 * failure after the card was charged). A succeeded PI is booked to available —
 * so the shortfall computed below already accounts for the collected money and
 * the card is never charged twice for it. This is what makes every "charged
 * but never booked" orphan (E020) self-heal instead of silently losing the
 * advertiser's money.
 *
 * Returns "unresolved" when a row's outcome could not be verified (Stripe
 * unreachable, PI still processing) — the caller must defer WITHOUT charging.
 */
async function recoverPendingPaygCharges(
  share: PaygShare,
): Promise<"clean" | "booked" | "unresolved"> {
  const rows = await prisma.stripeCreditPurchase.findMany({
    where: {
      externalRef: { startsWith: `payg-share:${share.id}:attempt:` },
      status: "PENDING",
    },
    select: {
      id: true,
      externalRef: true,
      amountCents: true,
      paygSurchargeCents: true,
      stripePaymentIntentId: true,
    },
  });

  let booked = false;
  let unresolved = false;
  const currentAttempt = share.paygChargeAttempts ?? 0;

  for (const row of rows) {
    const attemptNo = parseAttemptFromRef(row.externalRef!);

    if (!row.stripePaymentIntentId) {
      // No PI recorded. The CURRENT attempt's row is fine — the charge call
      // below reuses it (byte-stable Stripe replay resolves whether a PI
      // exists). A row from an OLDER attempt can never be replayed (its key
      // rotated), and without a PI id there is nothing to retrieve — mark it
      // FAILED so it stops matching this pre-pass. (Reaching this requires a
      // crash inside the ms window before the PI-id stamp AND a later attempt
      // bump — if it ever carries real money, the Stripe dashboard shows an
      // unmatched PI with our metadata.)
      if (attemptNo !== null && attemptNo < currentAttempt) {
        await failOffSessionChargeRow(row.id, {
          code: null,
          message:
            "abandoned: no PaymentIntent recorded and the attempt key has rotated",
        });
      }
      continue;
    }

    try {
      const pi = await stripe.paymentIntents.retrieve(
        row.stripePaymentIntentId,
      );
      if (pi.status === "succeeded") {
        await bookRecoveredCharge(
          share,
          row as typeof row & { externalRef: string },
          pi,
          attemptNo ?? currentAttempt,
        );
        booked = true;
      } else if (
        pi.status === "canceled" ||
        pi.status === "requires_payment_method"
      ) {
        // Terminal non-success — the charge never collected. Close the row.
        await failOffSessionChargeRow(row.id, {
          code: pi.status,
          message: `payment intent status ${pi.status}`,
        });
      } else {
        // processing / requires_action — outcome genuinely unknown right now.
        unresolved = true;
      }
    } catch {
      // Could not verify (Stripe unreachable). Charging now could double-take.
      unresolved = true;
    }
  }

  if (unresolved) return "unresolved";
  return booked ? "booked" : "clean";
}

/**
 * Settles a LIVE (lock-less) PAYG share: consume available credits first, then
 * charge the advertiser's card off-session for the shortfall, then pay the
 * customer. There is no SHARE_LOCK — the funds come from available + the card.
 *
 * - shortfall === 0 (credits cover it) → settle from available, no card touched.
 * - no card on file (removed while share was in-flight) → settle immediately with
 *   allowNegativeAdvertiserBalance, no retry cycle. Customer paid in full.
 * - shortfall  >  0 → charge card (+surcharge) → PAYG_CHARGE (+shortfall to
 *   available) → settle (spends it) → mark PAID.
 * - DEFINITIVE decline → `handleDecline`: close the period (CHARGE_FAILED, stops
 *   new shares), bump attempts + backoff and DEFER; once attempts are exhausted,
 *   settle the customer in full and let the advertiser balance go negative (the
 *   receivable).
 * - AMBIGUOUS charge failure (timeout / 5xx / idempotency_error — the charge
 *   may exist) → defer WITHOUT bumping attempts or closing the period; the next
 *   run's recovery pre-pass (`recoverPendingPaygCharges`) retrieves the PI via
 *   the externalRef row and books it before recomputing the shortfall, so a
 *   collected charge is never lost and never re-collected.
 *
 * Idempotent across retries: the Stripe idempotency key prevents double-charging,
 * and PAYG_CHARGE / SHARE_PAYMENT are idempotent on their external refs.
 *
 * ⚠️ INTENDED (signed off 2026-07-31): a single charge can exceed this share's
 * own price. `shortfall = finalPrice − available` is computed against an
 * `available` that may be **negative** — a negative balance is an uncollectable
 * receivable left behind by an earlier PAYG share that exhausted its retries
 * (see `handleDecline` above). When that happens the shortfall, and therefore the
 * card charge, covers this share's price PLUS the outstanding receivable, so a
 * later share's charge is what actually collects the earlier debt.
 *
 * This is deliberate — it is how the receivable is recovered at all, and it has
 * caused no problems in practice. It is documented here because the behaviour is
 * invisible at the call site and has consent/receipt implications: the advertiser
 * is charged more than the share being settled is worth, and the surcharge +
 * Stripe minimum are computed on the inflated amount. Do not "fix" it by
 * clamping `available` at zero without deciding how the receivable gets
 * collected instead.
 */
export async function settlePaygShare(
  share: PaygShare,
  priceResult: PriceResult,
): Promise<Exclude<SharePaymentOutcome, "unpayable">> {
  const { id: shareId, advertiserId } = share;
  const finalPrice = priceResult.finalPriceCents;
  const customerId = priceResult.customerId;

  // Deferral: back off and let the worker re-pick after paygNextRetryAt.
  // Does NOT bump paygChargeAttempts — deferral is "outcome unknown / not
  // now", not a decline, and the attempt key must stay stable so the retry
  // can find/replay any charge already placed under it.
  const deferShare = async (message: string) => {
    await prisma.share
      .update({
        where: { id: shareId },
        data: {
          paygNextRetryAt: new Date(
            Date.now() + PAYG_SETTLEMENT.RETRY_BACKOFF_BASE_MS,
          ),
          // Persist the failure so admins can see why this share keeps deferring.
          lastProcessingError: message,
          lastProcessingErrorAt: new Date(),
        },
      })
      .catch(() => {});
    return "deferred" as const;
  };

  // Resolve any charge a previous run collected but failed to book, BEFORE
  // reading `available` — a recovered charge credits the balance and shrinks
  // (usually zeroes) the shortfall, which is exactly what prevents charging
  // the card a second time for money we already hold.
  const recovery = await recoverPendingPaygCharges(share);
  if (recovery === "unresolved") {
    reportWorkerError(
      new Error("PAYG charge outcome unverifiable; deferring settle"),
      {
        worker: "sharePayment",
        phase: "job",
        shareId,
        shareUid: share.uid,
        paygFunding: "card",
        note: "pending charge row could not be verified against Stripe; deferring rather than risking a double charge",
      },
    );
    return deferShare("pending PAYG charge could not be verified with Stripe");
  }

  // Credits-first: the card covers only what available credits can't.
  const adv = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      sensitiveData: {
        select: { availableBudgetUsdCents: true, savedPaymentMethodId: true },
      },
    },
  });
  const available = adv?.sensitiveData?.availableBudgetUsdCents ?? 0n;
  const shortfall = finalPrice > available ? finalPrice - available : 0n;

  // Credits cover it entirely → settle from available, no card charge.
  if (shortfall === 0n) {
    await prisma.$transaction(async (tx) => {
      await markSharePaidOrThrow(tx, shareId);
      await persistFinalPrice(tx, shareId, priceResult);
      const settle = await settleSharePayoutAndUnlockRemainder(tx, {
        advertiserId,
        customerId,
        shareId,
        grossPriceCents: finalPrice,
        currencyOverride: "usd",
        // The settle always pays the customer in full; if a concurrent
        // same-advertiser settle drained `available` since the outside-tx read
        // above, the difference becomes the advertiser receivable (negative
        // available), exactly as the no-card / exhausted paths do.
        meta: { algoVersion: priceResult.algoVersion, paygFunding: "credits" },
      });
      await recordSettledOnFinalPrice(tx, shareId, settle);
    });
    return "paid";
  }

  // No card on file — advertiser removed it while this share was in-flight.
  // Skip the retry cycle entirely: pay the customer immediately and let the
  // advertiser balance go negative (same uncollectable-receivable path as
  // exhausted retries, but without making the customer wait).
  if (!adv?.sensitiveData?.savedPaymentMethodId) {
    await prisma.$transaction(async (tx) => {
      await markSharePaidOrThrow(tx, shareId);
      await persistFinalPrice(tx, shareId, priceResult);
      const settle = await settleSharePayoutAndUnlockRemainder(tx, {
        advertiserId,
        customerId,
        shareId,
        grossPriceCents: finalPrice,
        currencyOverride: "usd",
        meta: { algoVersion: priceResult.algoVersion, paygFunding: "no-card" },
      });
      await recordSettledOnFinalPrice(tx, shareId, settle);
    });
    return "paid";
  }

  // Shortfall > 0 → charge the card off-session (outside any tx).
  //
  // Idempotency key is per-ATTEMPT, not per-share. Stripe caches the response
  // (including a decline) for 24h, so a stable per-share key would make every
  // retry replay the cached decline — the card would never be re-attempted after
  // the advertiser fixes it. `paygChargeAttempts` bumps only on a DEFINITIVE
  // decline (never on ambiguous failure/deferral), so within an attempt the key
  // is stable and the request byte-identical (the util reuses the externalRef
  // row's uid + amount) — a charge that succeeded on a crashed run is found
  // again via Stripe replay or the recovery pre-pass, never re-collected.
  const attemptNo = share.paygChargeAttempts ?? 0;
  let charge;
  try {
    charge = await chargeAdvertiserCardOffSession(
      advertiserId,
      Number(shortfall),
      {
        // PAYG_CHARGE + the 30¢ surcharge + `payg_share`, settle-path-owned —
        // the charger owns that tuple; see its FLOWS table.
        flow: "PAYG_SHARE",
        // The durable per-attempt identity (Stripe idempotency key AND the
        // row the charger finds-or-creates for byte-stable retries, which the
        // recovery pre-pass books from).
        attemptRef: attemptChargeKey(shareId, attemptNo),
      },
    );
  } catch (err) {
    // 1342 = AMBIGUOUS (timeout / 5xx / idempotency_error / PI not terminal):
    // the charge may exist. Deferring keeps the attempt key stable so the next
    // run's pre-pass or byte-stable replay resolves it. Booking this as a
    // decline was E064: it closed the PAYG period and told the advertiser
    // their working card failed — and the attempt bump rotated the key, which
    // is what turned a recoverable blip into a double charge (E020).
    if (isCustomError(err) && err.error.code === 1342) {
      reportWorkerError(err, {
        worker: "sharePayment",
        phase: "job",
        shareId,
        shareUid: share.uid,
        paygFunding: "card",
        note: "ambiguous charge outcome; deferred (recovery pre-pass will book it if it collected)",
      });
      return deferShare(
        "card charge outcome unknown; deferred for verification",
      );
    }
    // Definitive decline (1337) — or a pre-charge domain failure (no card on
    // file etc.). Same handling as before: close the period, back off / exhaust.
    return handleDecline(share, priceResult);
  }

  // Charge succeeded — money is in. A failure booking the ledger below must NOT
  // mark the share UNPAYABLE (that would keep the money without paying the
  // customer). Defer instead: the Stripe idempotency key + idempotent ledger
  // refs make the retry safely reuse this same charge.
  try {
    await prisma.$transaction(async (tx) => {
      await markSharePaidOrThrow(tx, shareId);
      await persistFinalPrice(tx, shareId, priceResult);
      // Card → available. charge.amountCents is gross − surcharge; when we
      // rounded up to Stripe's $0.50 minimum, this is larger than shortfall —
      // the extra flows into available as a micro top-up for the next share.
      await createPaygChargeEvent(tx, {
        advertiserId,
        deltaAdvertiserCents: charge.amountCents,
        shareId,
        externalRef: attemptChargeLedgerRef(shareId, attemptNo),
        stripeCreditPurchaseId: charge.stripeCreditPurchaseId,
        meta: {
          paymentIntentId: charge.paymentIntentId,
          shortfallCents: shortfall.toString(),
        },
      });
      // Settle: spends the just-credited available (lock-less → currency override).
      const settle = await settleSharePayoutAndUnlockRemainder(tx, {
        advertiserId,
        customerId,
        shareId,
        grossPriceCents: finalPrice,
        currencyOverride: "usd",
        // The card was charged for `shortfall` computed from the outside-tx
        // `available` read; if a concurrent same-advertiser settle drained
        // `available` in between, the card is undercharged — the settle still
        // pays the customer in full and the difference goes negative on
        // available (the advertiser receivable).
        meta: { algoVersion: priceResult.algoVersion, paygFunding: "card" },
      });
      await recordSettledOnFinalPrice(tx, shareId, settle);
      await completeOffSessionChargeRow(tx, charge);
    });
  } catch (err) {
    // The settle claim was refused AFTER the card was charged — either a
    // concurrent void owns the share, or a report was filed / ruled VALID in the
    // window (the report hold re-checked inside `markSharePaidOrThrow`).
    // Don't pay the customer, but the collected money must not be orphaned:
    // book the charge as advertiser available credit and complete the
    // StripeCreditPurchase row (idempotent refs make a re-run of this safe).
    // A later DISMISSED verdict retries the settle, which then finds the
    // credited available covers the price and settles from credits.
    if (err instanceof ShareNotProcessingError) {
      await prisma.$transaction(async (tx) => {
        await createPaygChargeEvent(tx, {
          advertiserId,
          deltaAdvertiserCents: charge.amountCents,
          shareId,
          externalRef: attemptChargeLedgerRef(shareId, attemptNo),
          stripeCreditPurchaseId: charge.stripeCreditPurchaseId,
          meta: {
            paymentIntentId: charge.paymentIntentId,
            shortfallCents: shortfall.toString(),
            note: "share voided or report-held before settle; charge credited to available",
          },
        });
        await completeOffSessionChargeRow(tx, charge);
      });
      // Rare and money-relevant → keep it visible in the error inbox.
      reportWorkerError(err, {
        worker: "sharePayment",
        phase: "job",
        shareId,
        shareUid: share.uid,
        paygFunding: "card",
        note: "share voided concurrently post-charge; charge booked to available, payout skipped",
      });
      return "skipped";
    }

    const message = (err as Error)?.message ?? String(err);
    // The card was charged but the ledger booking failed. Money moved, and the
    // PI id is already stamped on the externalRef row — the next run's recovery
    // pre-pass retrieves the PI and books it before recomputing the shortfall,
    // so the retry cannot re-collect. Report AND alert (deduped per share).
    reportWorkerError(err, {
      worker: "sharePayment",
      phase: "job",
      shareId,
      shareUid: share.uid,
      paygFunding: "card",
      note: "post-charge settle failed; deferring retry",
      notify: true,
      notifyKey: `payg-post-charge-settle-fail:${shareId}`,
    });
    await prisma.share
      .update({
        where: { id: shareId },
        data: {
          paygNextRetryAt: new Date(
            Date.now() + PAYG_SETTLEMENT.RETRY_BACKOFF_BASE_MS,
          ),
          // Persist the failure so admins can see why this share keeps deferring.
          lastProcessingError: message,
          lastProcessingErrorAt: new Date(),
        },
      })
      .catch(() => {});
    return "deferred";
  }

  return "paid";
}

/**
 * A settlement charge declined. Close the PAYG period (CHARGE_FAILED) so no new
 * shares accrue on the failing card, then either back off for a retry or — once
 * attempts are exhausted — pay the customer in full and let the advertiser
 * balance go negative (the uncollectable receivable). The card stays on file.
 */
async function handleDecline(
  share: PaygShare,
  priceResult: PriceResult,
): Promise<"paid" | "deferred"> {
  const attempts = (share.paygChargeAttempts ?? 0) + 1;

  // Pause PAYG: stop new shares from accruing on a card that's failing. Notify
  // the advertiser only on the open→closed transition (count > 0), so repeated
  // declines across in-flight shares / retries don't spam them.
  const periodsClosed = await closePaygPeriod(
    share.advertiserId,
    "CHARGE_FAILED",
  );
  if (periodsClosed > 0) {
    await queueNotificationJobs({
      eventSlug: "a.balance.payg-charge-failed",
      advertiserIds: [share.advertiserId],
      dedupeKey: `payg-charge-failed:${share.advertiserId}:${share.id}`,
    }).catch(() => {});
  }

  if (attempts >= PAYG_SETTLEMENT.MAX_CHARGE_ATTEMPTS) {
    // Exhausted → customer paid in full; advertiser available goes negative.
    await prisma.$transaction(async (tx) => {
      await markSharePaidOrThrow(tx, share.id, {
        paygChargeAttempts: attempts,
      });
      await persistFinalPrice(tx, share.id, priceResult);
      const settle = await settleSharePayoutAndUnlockRemainder(tx, {
        advertiserId: share.advertiserId,
        customerId: priceResult.customerId,
        shareId: share.id,
        grossPriceCents: priceResult.finalPriceCents,
        currencyOverride: "usd",
        meta: {
          algoVersion: priceResult.algoVersion,
          paygFunding: "uncollectable-negative",
          chargeAttempts: attempts,
        },
      });
      await recordSettledOnFinalPrice(tx, share.id, settle);
    });
    return "paid";
  }

  // Not exhausted → backoff; the worker re-picks it after paygNextRetryAt.
  await prisma.share.update({
    where: { id: share.id },
    data: {
      paygChargeAttempts: attempts,
      paygNextRetryAt: new Date(Date.now() + chargeRetryBackoffMs(attempts)),
    },
  });
  return "deferred";
}

/**
 * Stamps the settle outcome onto the share's FinalPrice row (created just before
 * by `persistFinalPrice`, same tx). Shared by all four PAYG settle paths so the
 * column mapping lives once. PAYG always pays the customer in full (credits, card,
 * or a negative-balance receivable), so `capReason` is expected to be null here —
 * we still pass it through rather than hardcode, keeping one settle contract.
 */
async function recordSettledOnFinalPrice(
  tx: Prisma.TransactionClient,
  shareId: number,
  settle: {
    actualGrossPaid: bigint;
    capReason: "LOW_BUDGET" | "OVER_LOCK" | null;
  },
): Promise<void> {
  await tx.finalPrice.update({
    where: { shareId },
    data: {
      settledGrossCents: settle.actualGrossPaid,
      capReason: settle.capReason,
    },
  });
}
