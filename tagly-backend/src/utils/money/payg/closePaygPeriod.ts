import prisma from "../../../prisma/prisma.js";
import { Prisma, PaygPeriodEndReason } from "../../../generated/prisma/client.js";

/**
 * Closes the advertiser's open PAYG period (if any), recording why.
 *
 * Idempotent — a no-op when there is no open period.
 *
 * @returns the number of periods closed (0 or 1) — callers can use this to
 *   fire side effects (e.g. charge-failed notification) only on the transition.
 */
export async function closePaygPeriod(
  advertiserId: number,
  reason: PaygPeriodEndReason,
  tx: Prisma.TransactionClient = prisma,
): Promise<number> {
  const res = await tx.paygPeriod.updateMany({
    where: { advertiserId, endedAt: null },
    data: { endedAt: new Date(), endedReason: reason },
  });
  return res.count;
}
