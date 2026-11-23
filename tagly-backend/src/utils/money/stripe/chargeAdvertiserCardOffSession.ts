import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../clients/stripe.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { generateUid } from "../../core/uids/generateUid.js";
import { STRIPE_MIN_CHARGE_CENTS } from "../../../constants/billing/STRIPE.js";
import { isDefinitiveStripeRejection } from "./stripeErrorClassification.js";
import { STRIPE_PAYMENT_PURPOSE } from "./paymentMetadataPurpose.js";
import { failOffSessionChargeRow } from "./offSessionChargeRow.js";
import { PAYG } from "@tagly/models/shared";
import {
  Prisma,
  type CreditPurchaseKind,
} from "../../../generated/prisma/client.js";
import type Stripe from "stripe";

export type OffSessionChargeResult = {
  stripeCreditPurchaseId: number;
  creditPurchaseUid: string;
  paymentIntentId: string;
  chargeId: string | null;
  /** Credited (useful) amount — what funds the budget (gross − surcharge). */
  amountCents: bigint;
  /** Surcharge the advertiser paid on top (offsets Stripe's fixed per-transaction fee). */
  surchargeCents: number;
  /** Total charged to card (amountCents + surchargeCents). */
  grossCents: number;
};

/**
 * The two things that charge the saved card, and everything that differs
 * between them. A caller names its flow; the charger owns the tuple, so no
 * call site can combine the pieces inconsistently (e.g. a PAYG_CHARGE row the
 * reconcile worker would then try to book as a credit purchase).
 */
export type OffSessionChargeFlow = "PAYG_SHARE" | "MONTHLY_BUDGET_TOPUP";

const FLOWS: Record<
  OffSessionChargeFlow,
  {
    /** What the `StripeCreditPurchase` row represents. */
    kind: CreditPurchaseKind;
    /** Fixed surcharge added on top of the amount (0 for none). */
    surchargeCents: number;
    /** `metadata.purpose` on the PaymentIntent — what the webhooks gate on. */
    purpose: string;
  }
> = {
  // PAYG settlement (`settlePaygShare`): the advertiser pays the fixed Stripe
  // fee on a few-dollar charge; the row is non-refundable (flows straight
  // through to a payout).
  PAYG_SHARE: {
    kind: "PAYG_CHARGE",
    surchargeCents: PAYG.SURCHARGE_CENTS,
    purpose: STRIPE_PAYMENT_PURPOSE.PAYG_SHARE,
  },
  // Monthly-budget top-up (`runMonthlyBudgetTopUp`): a $50+ top-up absorbs
  // the fee like a manual purchase, and is an ordinary refundable credit
  // purchase.
  MONTHLY_BUDGET_TOPUP: {
    kind: "CREDIT_PURCHASE",
    surchargeCents: 0,
    purpose: STRIPE_PAYMENT_PURPOSE.MONTHLY_BUDGET_TOPUP,
  },
};

/**
 * Off-session charges the advertiser's saved card for `amountCents` (plus the
 * flow's surcharge). The ONE off-session charger — the money-idempotency core
 * — parameterised by `flow` rather than forked (a copy would drift). Reached
 * from exactly two places, both workers under a singleton lock: the
 * sharePayment worker's `settlePaygShare` and the stripe worker's
 * `runMonthlyBudgetTopUp`. Nothing in an HTTP request charges a card.
 *
 * ## Durable retry identity (`opts.attemptRef`)
 *
 * The per-attempt ref is BOTH the Stripe idempotency key and the
 * `StripeCreditPurchase.externalRef`, so the DB row and the Stripe request are
 * 1:1. The PENDING row is **found-or-created by that ref**, and an existing
 * row's `uid` + amounts are REUSED so the retried PaymentIntent request is
 * byte-identical to the original. That is what makes Stripe's idempotency
 * layer actually replay the original response — same key + *different* body
 * (a fresh uid in metadata, a recomputed amount) returns `idempotency_error`,
 * not the original PI, which historically turned every crash-retry into a
 * false decline and then a double charge (E020/E064). If the row already
 * carries a `stripePaymentIntentId`, the PI is retrieved instead of
 * re-created, so a charge that succeeded on a previous run is returned as-is.
 * The PI id is stamped onto the row immediately after creation (outside any
 * caller transaction) so a later crash leaves a reconcilable trail.
 *
 * ## Error contract
 *
 * - `1337` (402) — DEFINITIVE failure: Stripe understood and refused (card
 *   declined, invalid request, `authentication_required`), or the PI landed in a
 *   terminal non-success state. The row is marked FAILED. Treat as a decline.
 * - `1342` (502) — AMBIGUOUS failure: timeout / 5xx / rate limit /
 *   `idempotency_error` / PI still in a non-terminal state. **The charge may
 *   exist.** The row is left PENDING (with the PI id when known) so the
 *   caller's recovery pass can book it later. Do NOT treat as a decline and do
 *   NOT rotate the attempt ref — defer and retry.
 *
 * Booking the ledger from the result is the caller's responsibility, inside a
 * transaction (and so is completing the row — `completeOffSessionChargeRow`).
 *
 * ## Who resolves a row left PENDING
 *
 * The row's `kind` decides, nothing else: the stripe worker's missed-webhook
 * backstop (`findStripeJobs`) reconciles only `CREDIT_PURCHASE` rows, so a
 * monthly-budget row is booked by the webhook or the worker exactly like a
 * PaymentSheet top-up; a `PAYG_CHARGE` row is share-scoped and is booked only
 * by `settlePaygShare`'s recovery pre-pass. `nextReconcileAt` is the worker's
 * own retry clock and is left at its default here.
 */
export async function chargeAdvertiserCardOffSession(
  advertiserId: number,
  amountCents: number,
  opts: {
    flow: OffSessionChargeFlow;
    /** Per-attempt identity: Stripe idempotency key AND the row's `externalRef`. */
    attemptRef: string;
  },
): Promise<OffSessionChargeResult> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw createCustomError(1335, "charge amount must be > 0", 400);
  }
  const flow = FLOWS[opts.flow];

  const adv = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      uid: true,
      sensitiveData: {
        select: { stripeCustomerId: true, savedPaymentMethodId: true },
      },
    },
  });
  if (!adv) throw createCustomError(1304, "advertiser not found", 404);

  const stripeCustomerId = adv.sensitiveData.stripeCustomerId;
  // Must be the saved off-session-mandate card (off-session SetupIntent) —
  // never `defaultPaymentMethodId`, the generic credit-purchase card, which has
  // no MIT mandate and would decline off-session.
  const paymentMethodId = adv.sensitiveData.savedPaymentMethodId;
  if (!stripeCustomerId || !paymentMethodId) {
    throw createCustomError(1336, "no saved card on file to charge", 400);
  }

  const surchargeCents = flow.surchargeCents;
  // Stripe requires a minimum charge of $0.50. If the shortfall + surcharge is
  // below that, round up. The extra flows into the advertiser's available balance
  // as a micro top-up, reducing or eliminating the next charge.
  const computedGrossCents = Math.max(
    amountCents + surchargeCents,
    STRIPE_MIN_CHARGE_CENTS,
  );
  const currency = "usd";

  // Find-or-create the PENDING row by attemptRef. An existing row wins and
  // FREEZES uid + amounts for this attempt — byte-stable retries (see the
  // docblock).
  let row: {
    id: number;
    uid: string;
    grossCents: number;
    surchargeCents: number;
    stripePaymentIntentId: string | null;
    status: string;
  };

  const existing = await prisma.stripeCreditPurchase.findUnique({
    where: { externalRef: opts.attemptRef },
    select: {
      id: true,
      uid: true,
      amountCents: true,
      paygSurchargeCents: true,
      stripePaymentIntentId: true,
      status: true,
    },
  });

  if (existing) {
    if (existing.status === "COMPLETED") {
      // This attempt's charge was already booked (recovery pass or a prior
      // run). A NEW charge under the same key would be a different body →
      // idempotency_error — and re-using a booked charge would double-count.
      // Ambiguous by contract: the caller defers; its next run recomputes the
      // shortfall against the already-credited balance.
      throw createCustomError(
        1342,
        "charge for this attempt already booked; recompute before charging again",
        { status: 502 },
      );
    }
    row = {
      id: existing.id,
      uid: existing.uid,
      grossCents: Number(existing.amountCents),
      // A null surcharge column means "none" (see the create below), not
      // "unknown" — never fall back to the flow's value here, or a replayed
      // request could differ from the original.
      surchargeCents: Number(existing.paygSurchargeCents ?? 0n),
      stripePaymentIntentId: existing.stripePaymentIntentId,
      status: existing.status,
    };
  } else {
    const creditPurchaseUid = generateUid("CREDIT_PURCHASE");
    try {
      const created = await prisma.stripeCreditPurchase.create({
        data: {
          uid: creditPurchaseUid,
          advertiserId,
          currency,
          // amountCents = gross (amount + surcharge). Matches the card statement.
          amountCents: BigInt(computedGrossCents),
          // Null when there is no surcharge (a monthly-budget top-up) — the
          // column is documented as PAYG-only.
          paygSurchargeCents:
            surchargeCents > 0 ? BigInt(surchargeCents) : null,
          // `kind` also decides who reconciles a PENDING row — see the
          // docblock. `nextReconcileAt` stays at its default (the worker's
          // own clock).
          kind: flow.kind,
          status: "PENDING",
          externalRef: opts.attemptRef,
        },
        select: { id: true },
      });
      row = {
        id: created.id,
        uid: creditPurchaseUid,
        grossCents: computedGrossCents,
        surchargeCents,
        stripePaymentIntentId: null,
        status: "PENDING",
      };
    } catch (e) {
      // P2002 on externalRef: a concurrent caller created the row first
      // (theoretical under the worker singleton locks, but harmless to handle).
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw createCustomError(
          1342,
          "concurrent charge attempt for the same ref; deferring",
          { status: 502, cause: e },
        );
      }
      throw e;
    }
  }

  const resultFromPi = (pi: Stripe.PaymentIntent): OffSessionChargeResult => {
    let chargeId: string | null = null;
    const latestCharge = pi.latest_charge;
    if (typeof latestCharge === "string") chargeId = latestCharge;
    else if (latestCharge?.id) chargeId = latestCharge.id;
    return {
      stripeCreditPurchaseId: row.id,
      creditPurchaseUid: row.uid,
      paymentIntentId: pi.id,
      chargeId,
      amountCents: BigInt(row.grossCents - row.surchargeCents),
      surchargeCents: row.surchargeCents,
      grossCents: row.grossCents,
    };
  };

  // A PI already exists for this attempt (a previous run created it and stamped
  // the id before crashing/failing to settle) — retrieve, don't re-create.
  if (row.stripePaymentIntentId) {
    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.retrieve(row.stripePaymentIntentId);
    } catch (err) {
      throw createCustomError(
        1342,
        "could not verify existing charge; deferring",
        { status: 502, cause: err },
      );
    }
    if (pi.status === "succeeded") return resultFromPi(pi);
    if (pi.status === "canceled" || pi.status === "requires_payment_method") {
      // Terminal non-success: the confirm failed (decline) or the PI was
      // canceled. Definitive.
      await failOffSessionChargeRow(row.id, {
        code: pi.status,
        message: `payment intent status ${pi.status}`,
      });
      throw createCustomError(1337, "card charge failed", 402);
    }
    // processing / requires_action / requires_confirmation — not terminal yet.
    throw createCustomError(
      1342,
      `existing charge still ${pi.status}; deferring`,
      { status: 502 },
    );
  }

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.create(
      {
        amount: row.grossCents,
        currency,
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: {
          advertiserId: String(advertiserId),
          advertiserUid: adv.uid,
          purpose: flow.purpose,
          creditPurchaseUid: row.uid,
        },
      },
      { idempotencyKey: opts.attemptRef },
    );
  } catch (err: any) {
    if (isDefinitiveStripeRejection(err)) {
      // Stripe received, understood, and refused — the PI was certainly not
      // created (card declined / authentication_required / invalid request).
      await failOffSessionChargeRow(row.id, {
        code: err?.code?.toString?.() ?? null,
        message: err?.message?.toString?.() ?? "off-session charge failed",
      });
      throw createCustomError(1337, "card charge failed", {
        status: 402,
        cause: err,
      });
    }
    // Ambiguous (timeout / 5xx / rate limit / idempotency_error): the charge
    // MAY exist. Leave the row PENDING so the recovery pass / byte-stable
    // replay can resolve it — never book a decline off this.
    throw createCustomError(1342, "card charge outcome unknown", {
      status: 502,
      cause: err,
    });
  }

  // Stamp the PI id immediately — the durable link that lets a later run
  // recover this exact charge if anything below (or in the caller) fails.
  // Best-effort: if this write is lost, the byte-stable replay still finds the
  // PI on the next run.
  await prisma.stripeCreditPurchase
    .update({
      where: { id: row.id },
      data: { stripePaymentIntentId: pi.id },
    })
    .catch(() => {});

  if (pi.status !== "succeeded") {
    await failOffSessionChargeRow(row.id, {
      code: pi.status,
      message: `payment intent status ${pi.status}`,
    });
    throw createCustomError(1337, "card charge not completed", 402);
  }

  return resultFromPi(pi);
}
