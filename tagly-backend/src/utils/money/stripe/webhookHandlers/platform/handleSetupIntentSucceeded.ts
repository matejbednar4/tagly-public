import type Stripe from "stripe";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import { stripe } from "../../../../clients/stripe.js";
import { linkCardFromSetupIntent } from "../../../savedCard/linkCardFromSetupIntent.js";
import { openPaygPeriod } from "../../../payg/openPaygPeriod.js";

/**
 * Handles setup_intent.succeeded events for payment method setup — the
 * guaranteed half of a card link (the client-driven reconcile endpoint is the
 * fast half; both call `linkCardFromSetupIntent`, so what a link means is
 * decided in one place, and the two paths are idempotent with each other).
 *
 * Linking is feature-agnostic. The one exception is the deprecated
 * `payg_setup` intent from pre-2026-09 builds, which expect the link alone to
 * turn PAYG on — for those the period is opened here as a separate step.
 *
 * For any other purpose (a PaymentSheet top-up saving its card): sets
 * defaultPaymentMethodId if none exists yet.
 */
export async function handleSetupIntentSucceeded(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
) {
  const si = event.data.object as Stripe.SetupIntent;

  let customerId: string | undefined;
  if (typeof si.customer === "string") {
    customerId = si.customer;
  } else {
    customerId = si.customer?.id;
  }
  if (!customerId) return;

  const adv = await tx.advertiser.findFirst({
    where: { sensitiveData: { stripeCustomerId: customerId } },
    select: {
      id: true,
      sensitiveData: {
        select: {
          id: true,
          defaultPaymentMethodId: true,
          savedPaymentMethodId: true,
        },
      },
    },
  });
  if (!adv?.sensitiveData?.id) return;

  const result = await linkCardFromSetupIntent(tx, {
    setupIntent: si,
    sensitiveDataId: adv.sensitiveData.id,
    previousPmId: adv.sensitiveData.savedPaymentMethodId,
  });

  if (result.outcome === "LINKED") {
    // @deprecated back-compat: legacy PAYG link → also turn PAYG on
    // (idempotent — no-op if a period is already open).
    if (result.legacyPaygSetup) await openPaygPeriod(adv.id, tx);

    // Detach the replaced card (best-effort). The webhook dispatcher owns the
    // commit, so — unlike the reconcile endpoint, which detaches post-commit —
    // this runs inside the tx. Idempotent: the reconcile/webhook race leaves
    // exactly one path seeing a replaced card.
    if (result.replacedPmId) {
      await stripe.paymentMethods.detach(result.replacedPmId).catch(() => {});
    }
    return;
  }

  if (result.outcome === "FOREIGN_PURPOSE") {
    // Generic saved card (credit purchases) — set only when none exists yet.
    const pmId =
      typeof si.payment_method === "string"
        ? si.payment_method
        : si.payment_method?.id;
    if (pmId && !adv.sensitiveData.defaultPaymentMethodId) {
      await tx.advertiserSensitiveData.update({
        where: { id: adv.sensitiveData.id },
        data: { defaultPaymentMethodId: pmId },
      });
    }
  }
  // NOT_SUCCEEDED / NO_PAYMENT_METHOD can't happen on a succeeded event with a
  // card; nothing to do.
}
