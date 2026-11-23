import type { Prisma } from "../../../generated/prisma/client.js";
import type { calculateFinalPrice } from "../../../utils/pricing/calculateFinalPrice.js";

type PriceResult = Awaited<ReturnType<typeof calculateFinalPrice>>;

/**
 * Persists the computed FinalPrice row for a share. Shared by every settle path
 * (subsidized / credits / converted-PAYG / live-PAYG) so the column mapping has
 * a single source of truth. Created exactly once, inside the settling tx.
 */
export async function persistFinalPrice(
  tx: Prisma.TransactionClient,
  shareId: number,
  priceResult: PriceResult,
): Promise<void> {
  await tx.finalPrice.create({
    data: {
      shareId,
      algoVersion: priceResult.algoVersion,
      baseValueCents: priceResult.baseValueCents,
      ecpmCents: priceResult.ecpmCents,
      qualifiedReach: priceResult.qualifiedReach,
      actionBonusesCents: priceResult.actionBonusesCents,
      geoMultiplierBps: priceResult.geoMultiplierBps,
      demoMultiplierBps: priceResult.demoMultiplierBps,
      interestMultiplierBps: priceResult.interestMultiplierBps,
      typeMultiplierBps: priceResult.typeMultiplierBps,
      ratingMultiplierBps: priceResult.ratingMultiplierBps,
      frequencyMultiplierBps: priceResult.frequencyMultiplierBps,
      audienceRelevanceMultiplierBps:
        priceResult.audienceRelevanceMultiplierBps,
      subtotalBeforeCapCents: priceResult.subtotalBeforeCapCents,
      subtotalAfterCapCents: priceResult.subtotalAfterCapCents,
      countryMultiplierBps: priceResult.countryMultiplierBps,
      accountQualityMultiplierBps: priceResult.accountQualityMultiplierBps,
      finalPriceCents: priceResult.finalPriceCents,
      currency: "usd",
    },
  });
}
