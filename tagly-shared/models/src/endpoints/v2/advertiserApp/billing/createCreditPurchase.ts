import { z } from "zod";
import { CreditPurchaseUidSchema } from "../../../../core/uids";
import { CREDIT_PURCHASES } from "../../../../constants/billing/DEPOSITS_WITHDRAWALS";

/**
 * `POST /v2/advertisers/me/billing/credit-purchases` — start a prepaid credit
 * top-up. Creates the PENDING purchase row + a bare PaymentIntent and returns
 * its client secret (+ Stripe customer & ephemeral key) for the native
 * PaymentSheet (no hosted Checkout / browser return URL).
 * Crediting stays webhook-driven (`payment_intent.succeeded`).
 */
export const CreateCreditPurchaseBodySchema = z.object({
  /** Top-up amount in USD cents. */
  amountCents: z
    .number()
    .int()
    .min(CREDIT_PURCHASES.MIN_AMOUNT_CENTS)
    .max(CREDIT_PURCHASES.MAX_AMOUNT_CENTS),
});
export type CreateCreditPurchaseBody = z.infer<
  typeof CreateCreditPurchaseBodySchema
>;

export const CreateCreditPurchaseResponseSchema = z.object({
  /** The PENDING purchase this payment funds. */
  creditPurchaseUid: CreditPurchaseUidSchema,
  /** Client secret the PaymentSheet confirms (payment mode). */
  paymentIntentClientSecret: z.string().min(1),
  /** The advertiser's Stripe customer id (PaymentSheet customer mode). */
  customerId: z.string().min(1),
  /** Short-lived key letting the PaymentSheet act on the customer. */
  ephemeralKeySecret: z.string().min(1),
});
export type CreateCreditPurchaseResponse = z.infer<
  typeof CreateCreditPurchaseResponseSchema
>;
