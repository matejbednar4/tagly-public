import type Stripe from "stripe";
import type { Prisma } from "../../../generated/prisma/client.js";
import { STRIPE_PAYMENT_PURPOSE } from "../stripe/paymentMetadataPurpose.js";

export type LinkCardFromSetupIntentResult =
  /** Not a card-link intent we own (e.g. a PaymentSheet top-up saving its card). */
  | { outcome: "FOREIGN_PURPOSE" }
  /** Ours, but not confirmed (yet) — the sheet was dismissed or is processing. */
  | { outcome: "NOT_SUCCEEDED" }
  /** Ours and confirmed, but Stripe attached no payment method. */
  | { outcome: "NO_PAYMENT_METHOD" }
  | {
      outcome: "LINKED";
      /** The previous card, when this link replaced a different one — the caller detaches it at Stripe AFTER commit. */
      replacedPmId: string | null;
      /**
       * @deprecated back-compat: true for a `payg_setup` intent (app builds
       * shipped before 2026-09), which expects the link alone to turn PAYG on.
       * The CALLER opens the PaygPeriod as a separate step. Always false once
       * those builds roll off — delete with the purpose.
       */
      legacyPaygSetup: boolean;
    };

/**
 * Turn a succeeded card-link SetupIntent into DB state: save (or replace)
 * the account's ONE off-session card, `AdvertiserSensitiveData.savedPaymentMethodId`.
 * That is ALL it does — which features charge the card (pay-as-you-go, the
 * monthly budget) is decided by their own endpoints, never by a link, and a
 * replacement leaves any open period untouched (the new card is simply what
 * it charges next).
 *
 * Both confirmations of a link call this — the client-driven reconcile
 * endpoint (fast path, polled right after the PaymentSheet) and the
 * `setup_intent.succeeded` webhook (guaranteed path) — so what a link means
 * is decided in exactly one place. Idempotent with itself (reconcile vs
 * webhook race): re-saving the same PM is a no-op write.
 *
 * Runs inside the caller's transaction and never talks to Stripe — detaching
 * a replaced card is the caller's post-commit, best-effort job (a Stripe
 * round-trip must not hold a DB transaction open). Callers own the IDOR check
 * that the intent belongs to this advertiser's Stripe customer.
 */
export async function linkCardFromSetupIntent(
  tx: Prisma.TransactionClient,
  args: {
    setupIntent: Stripe.SetupIntent;
    sensitiveDataId: number;
    previousPmId: string | null;
  },
): Promise<LinkCardFromSetupIntentResult> {
  const { setupIntent, sensitiveDataId, previousPmId } = args;

  const purpose = setupIntent.metadata?.purpose;
  const isCardSetup = purpose === STRIPE_PAYMENT_PURPOSE.CARD_SETUP;
  // @deprecated back-compat: see `legacyPaygSetup`.
  const legacyPaygSetup = purpose === STRIPE_PAYMENT_PURPOSE.PAYG_SETUP;
  if (!isCardSetup && !legacyPaygSetup) return { outcome: "FOREIGN_PURPOSE" };

  if (setupIntent.status !== "succeeded") return { outcome: "NOT_SUCCEEDED" };

  const pm = setupIntent.payment_method;
  const newPmId = typeof pm === "string" ? pm : (pm?.id ?? null);
  if (!newPmId) return { outcome: "NO_PAYMENT_METHOD" };

  await tx.advertiserSensitiveData.update({
    where: { id: sensitiveDataId },
    data: { savedPaymentMethodId: newPmId },
  });

  return {
    outcome: "LINKED",
    replacedPmId:
      previousPmId && previousPmId !== newPmId ? previousPmId : null,
    legacyPaygSetup,
  };
}
