import prisma from "../../../prisma/prisma.js";
import {
  Prisma,
  MonthlyBudgetPeriodEndReason,
} from "../../../generated/prisma/client.js";

/**
 * Closes the advertiser's open monthly-budget period (if any), recording why.
 * The twin of `closePaygPeriod`.
 *
 * Deliberately leaves `nextRunAt` / `chargeAttempts` as they were (audit: a
 * closed period still shows where its ladder stopped). The worker only polls
 * OPEN periods, so a closed one is never picked up regardless.
 *
 * Idempotent — a no-op when there is no open period.
 *
 * @returns the number of periods closed (0 or 1) — callers use it to fire
 *   side effects (the charge-failed notification) only on the transition.
 */
export async function closeMonthlyBudgetPeriod(
  advertiserId: number,
  reason: MonthlyBudgetPeriodEndReason,
  tx: Prisma.TransactionClient = prisma,
): Promise<number> {
  const res = await tx.monthlyBudgetPeriod.updateMany({
    where: { advertiserId, endedAt: null },
    data: { endedAt: new Date(), endedReason: reason },
  });
  return res.count;
}
