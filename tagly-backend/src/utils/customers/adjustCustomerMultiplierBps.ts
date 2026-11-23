import type { Prisma } from "../../generated/prisma/client.js";
import { CUSTOMER_RATING_MULTIPLIER } from "../../constants/rewards/CUSTOMER_RATING.js";

/**
 * Customer rolling-multiplier bookkeeping. Version-coupled on purpose: it reads
 * the `CUSTOMER_RATING_MULTIPLIER` scoring constants from `constants/`, so
 * the star→multiplier economics move with the reward algo version.
 *
 * Ratings are half-stars, and EACH star value has its own delta
 * (`DELTAS_BY_STARS`, 1–10 = ½★–5★; null = unrated → no effect).
 */
export function multiplierDeltaForStars(stars: number | null): number {
  if (stars == null) return 0;
  return CUSTOMER_RATING_MULTIPLIER.DELTAS_BY_STARS[stars] ?? 0;
}

/**
 * Adjusts a customer's rating multiplier by a delta amount.
 *
 * - Fetches current multiplier (defaults to 10000 if not set)
 * - Applies delta and clamps to the v2 min/max bounds
 * - Updates the customer's `sensitiveData.multiplierBps`
 *
 * @param tx - Prisma transaction client
 * @param customerId - The customer's ID
 * @param deltaBps - The change to apply (positive or negative)
 * @returns The new multiplier value after clamping
 */
export async function adjustCustomerMultiplierBps(
  tx: Prisma.TransactionClient,
  customerId: number,
  deltaBps: number
): Promise<number> {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { sensitiveData: { select: { multiplierBps: true } } },
  });

  const currentBps = customer?.sensitiveData?.multiplierBps ?? 10_000;

  const newBps = clampBps(currentBps + deltaBps);

  await tx.customer.update({
    where: { id: customerId },
    data: {
      sensitiveData: { update: { multiplierBps: newBps } },
    },
  });

  return newBps;
}

/** Clamp multiplier to the configured v2 min/max bounds. */
function clampBps(bps: number): number {
  if (bps < CUSTOMER_RATING_MULTIPLIER.minBps) {
    return CUSTOMER_RATING_MULTIPLIER.minBps;
  }
  if (bps > CUSTOMER_RATING_MULTIPLIER.maxBps) {
    return CUSTOMER_RATING_MULTIPLIER.maxBps;
  }
  return bps;
}
