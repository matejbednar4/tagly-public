import prisma from "../../../prisma/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";

/**
 * The two terminal-state writes on an off-session charge's
 * `StripeCreditPurchase` row (the per-attempt row `chargeAdvertiserCardOffSession`
 * finds-or-creates). Single-sourced so the PAYG settle path (normal booking,
 * voided-share booking, recovery pre-pass), the monthly-budget run, and the
 * charger itself can't drift on the guard or the columns:
 *
 * - both are CAS-guarded on `status: "PENDING"` — a row that already reached a
 *   terminal state (booked by a racing path, or a prior run) is left alone;
 * - `fail` is best-effort (the caller is already on an error path and must
 *   surface the Stripe outcome, not a DB hiccup).
 *
 * Neither touches a period or the card. A row's terminal state is one
 * attempt's outcome; what it means for the feature is each flow's policy
 * (`handleDecline` in `settlePaygShare` / `runMonthlyBudgetTopUp` — PAYG
 * closes its period on the first decline, the monthly budget only at
 * MAX_CHARGE_ATTEMPTS), and the card is never detached on a decline at all:
 * the ladders retry the SAME card, and removal is the advertiser's action
 * (`removeSavedCard`), which is why `CARD_FAILED` keeps it on file.
 */

/** Row → COMPLETED, stamping the PI (+ charge id when known). */
export async function completeOffSessionChargeRow(
  tx: Prisma.TransactionClient,
  charge: {
    stripeCreditPurchaseId: number;
    paymentIntentId: string;
    chargeId: string | null;
  },
): Promise<void> {
  await tx.stripeCreditPurchase.updateMany({
    where: { id: charge.stripeCreditPurchaseId, status: "PENDING" },
    data: {
      status: "COMPLETED",
      stripePaymentIntentId: charge.paymentIntentId,
      ...(charge.chargeId ? { stripeChargeId: charge.chargeId } : {}),
    },
  });
}

/** Row → FAILED with Stripe's decline detail. Best-effort, never throws. */
export async function failOffSessionChargeRow(
  stripeCreditPurchaseId: number,
  failure: { code: string | null; message: string },
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.stripeCreditPurchase
    .updateMany({
      where: { id: stripeCreditPurchaseId, status: "PENDING" },
      data: {
        status: "FAILED",
        failureCode: failure.code,
        failureMessage: failure.message,
      },
    })
    .catch(() => {});
}
