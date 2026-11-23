import { CREDIT_PURCHASES } from "./DEPOSITS_WITHDRAWALS";

export const PAYG = {
  /**
   * Per-charge surcharge (cents) the advertiser pays on a pay-as-you-go card
   * charge, to cover Stripe's fixed per-transaction fee. Added on top of the
   * funded amount; it does not increase the customer reward or Tagly's take.
   */
  SURCHARGE_CENTS: 30, // $0.30
  /**
   * Minimum monthly spend cap the advertiser can set. Mirrors the Zod schema
   * minimum. Deliberately pinned to the credit-purchase minimum so the two
   * funding floors stay identical (raised from $25 on 2026-07-21).
   */
  MIN_CAP_CENTS: CREDIT_PURCHASES.MIN_AMOUNT_CENTS, // $50.00
} as const;
