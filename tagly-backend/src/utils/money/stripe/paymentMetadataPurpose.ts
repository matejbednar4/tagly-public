/**
 * Single source of truth for the **Stripe payment-metadata `purpose`** vocabulary
 * — the lower-snake strings Tagly stamps into `metadata.purpose` on platform
 * PaymentIntents / SetupIntents / off-session charges, and gates on in the
 * platform webhook handlers.
 *
 * (Withdrawal purposes are a separate, DB-enum-backed vocabulary — see
 * `withdrawals/withdrawalPurpose.ts`. OTP-session / media-upload / JWT purposes
 * are unrelated domains with their own strings.)
 *
 * ⚠️ Frozen contract: these strings live in metadata on already-created Stripe
 * objects that the webhook handlers match on, so a value can never change. This
 * module exists so every writer (card setup, credit purchase, off-session
 * charge) and reader (setup-intent + payment-intent webhooks, PAYG reconcile)
 * shares one definition and a typo can't silently break a webhook match. The
 * literal values are FROZEN: Stripe objects created before this module existed
 * carry them inline in their metadata, and the permanent readers must keep
 * matching those too.
 */
export const STRIPE_PAYMENT_PURPOSE = {
  /**
   * @deprecated back-compat: SetupIntent that links the off-session saved card
   * AND turns pay-as-you-go on. Stamped only by app builds shipped before
   * 2026-09 (`setupPaygCard`); new code links with `CARD_SETUP` and turns PAYG
   * on via `POST /payg`. The readers must keep matching it while those builds
   * are in the wild (and forever for old Stripe objects, per the freeze rule).
   */
  PAYG_SETUP: "payg_setup",
  /**
   * SetupIntent that links the account's off-session saved card — and nothing
   * else. Which features charge that card (PAYG, monthly budget) is decided by
   * their own endpoints, never by the link.
   */
  CARD_SETUP: "card_setup",
  /** Off-session charge covering a PAYG share's shortfall. */
  PAYG_SHARE: "payg_share",
  /** PaymentIntent for a prepaid credit top-up. */
  CREDIT_PURCHASE: "credit_purchase",
  /**
   * Off-session PaymentIntent for the monthly-budget top-up. Booked EXACTLY
   * like a `credit_purchase` (same webhook crediting, same refund path) — a
   * distinct value only so the payment-failed webhook can leave the
   * notification to the monthly-budget run (which owns the retry ladder and
   * its own copy) instead of sending the generic "top-up failed" email.
   */
  MONTHLY_BUDGET_TOPUP: "monthly_budget_topup",
} as const;

/** Purposes whose PaymentIntents are booked as prepaid `CREDIT_PURCHASE`s. */
export const CREDIT_PURCHASE_PURPOSES: ReadonlySet<string> = new Set([
  STRIPE_PAYMENT_PURPOSE.CREDIT_PURCHASE,
  STRIPE_PAYMENT_PURPOSE.MONTHLY_BUDGET_TOPUP,
]);

export type StripePaymentPurpose =
  (typeof STRIPE_PAYMENT_PURPOSE)[keyof typeof STRIPE_PAYMENT_PURPOSE];
