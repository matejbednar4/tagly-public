import prisma from "../../../prisma/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { closeMonthlyBudgetPeriod } from "./closeMonthlyBudgetPeriod.js";
import { nextMonthlyBudgetRunAt } from "./monthlyBudgetSchedule.js";

/**
 * Opens the advertiser's monthly-budget period at `targetCents`. Periods are
 * immutable: if one is already open at a DIFFERENT target it is closed
 * (`TARGET_CHANGED`) and a new one opened — the period list is the target
 * history. If one is already open at the SAME target this is a no-op —
 * nothing is re-run, nothing is charged.
 *
 * Returns nothing: it used to hand the caller the period so the endpoint could
 * run the first top-up inline, but activation no longer charges, so there is
 * nothing to act on. (Mirrors `openPaygPeriod`, which returns only its id.)
 *
 * **Activation NEVER charges** (Matej, 2026-09-03). A new period is scheduled
 * for the next 1st at `CHARGE_HOUR_UTC`, so the stripe worker — the ONLY thing
 * that ever charges — first tops the advertiser up to X on that date. Nothing
 * here or in the calling endpoint touches Stripe.
 *
 * That single rule dissolves a whole class of timing bugs, because no charge
 * can be triggered by a user action or land near a UTC month boundary: a target
 * change can no longer collide with an in-flight ambiguous charge, and a `PUT`
 * after a `CHARGE_FAILED` pause can no longer bypass the decline ladder by
 * opening a period that charges on demand.
 *
 * Deliberately always the NEXT month, even when enabling on the 1st before the
 * run hour — "activation never charges" stays absolute, with no same-day
 * surprise for an advertiser who just turned it on.
 *
 * Invariants (the twin of `openPaygPeriod`):
 * 1. **A period may exist ONLY while a saved card is on file** (throws 1350
 *    otherwise). The card (`AdvertiserSensitiveData.savedPaymentMethodId`) is
 *    what the run charges; the period only records that the feature is on and
 *    at what level. The mirror direction is upheld by `removeSavedCard`, which
 *    closes this period in the same transaction it clears the card.
 * 2. **At most one open period per advertiser** — the partial unique index
 *    `monthly_budget_periods_one_open_per_advertiser`; `createMany({
 *    skipDuplicates })` compiles to INSERT … ON CONFLICT DO NOTHING, so a
 *    concurrent double-open no-ops instead of raising P2002, and the follow-up
 *    read returns the surviving open period.
 */
export async function openMonthlyBudgetPeriod(
  advertiserId: number,
  targetCents: bigint,
  now: Date,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  const adv = await tx.advertiser.findUnique({
    where: { id: advertiserId },
    select: { sensitiveData: { select: { savedPaymentMethodId: true } } },
  });
  if (!adv?.sensitiveData?.savedPaymentMethodId) {
    throw createCustomError(
      1350,
      "cannot enable the monthly budget without a saved card on file",
      400,
    );
  }

  const open = await tx.monthlyBudgetPeriod.findFirst({
    where: { advertiserId, endedAt: null },
    select: { id: true, targetCents: true },
  });
  if (open && open.targetCents === targetCents) return;
  if (open) {
    await closeMonthlyBudgetPeriod(advertiserId, "TARGET_CHANGED", tx);
  }

  await tx.monthlyBudgetPeriod.createMany({
    data: [
      { advertiserId, targetCents, nextRunAt: nextMonthlyBudgetRunAt(now) },
    ],
    skipDuplicates: true,
  });
}
