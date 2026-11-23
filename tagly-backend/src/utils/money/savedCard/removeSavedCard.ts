import prisma from "../../../prisma/prisma.js";
import { stripe } from "../../clients/stripe.js";
import { createCustomError } from "../../core/errors/createCustomError.js";
import { closePaygPeriod } from "../payg/closePaygPeriod.js";
import { closeMonthlyBudgetPeriod } from "../monthlyBudget/closeMonthlyBudgetPeriod.js";

/**
 * Unlink the advertiser's saved off-session card. The ONLY card-clearer, and
 * it closes BOTH feature periods (PAYG + monthly budget, reason
 * `CARD_REMOVED`) in the same transaction — upholding the "a feature period
 * exists only while a card is on file" invariant that `openPaygPeriod` /
 * `openMonthlyBudgetPeriod` enforce on the way in. Turning a single feature
 * off while keeping the card is a different action (`closePaygPeriod` /
 * `closeMonthlyBudgetPeriod` with `DISABLED`).
 *
 * In-flight PAYG shares are left as-is (settlement finds no card and settles
 * negative — see `removePaygCard`). `offSessionChargeAuthorizedAt` is kept —
 * a durable consent record, not tied to the card.
 *
 * Detaches the card at Stripe AFTER the transaction commits (best-effort).
 * Throws 1338 when there is no card to remove.
 */
export async function removeSavedCard(advertiserId: number): Promise<{
  detachedPmId: string;
  closedPayg: boolean;
  closedMonthlyBudget: boolean;
}> {
  const adv = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      sensitiveData: { select: { id: true, savedPaymentMethodId: true } },
    },
  });
  if (!adv) throw createCustomError(1304, "advertiser not found", 404);

  const pmId = adv.sensitiveData.savedPaymentMethodId;
  if (!pmId) throw createCustomError(1338, "No saved card to remove", 400);

  const { closedPayg, closedMonthlyBudget } = await prisma.$transaction(
    async (tx) => {
      const closedPayg =
        (await closePaygPeriod(advertiserId, "CARD_REMOVED", tx)) > 0;
      const closedMonthlyBudget =
        (await closeMonthlyBudgetPeriod(advertiserId, "CARD_REMOVED", tx)) > 0;
      await tx.advertiserSensitiveData.update({
        where: { id: adv.sensitiveData.id },
        data: { savedPaymentMethodId: null },
      });
      return { closedPayg, closedMonthlyBudget };
    },
  );

  await stripe.paymentMethods.detach(pmId).catch(() => {});

  return { detachedPmId: pmId, closedPayg, closedMonthlyBudget };
}
