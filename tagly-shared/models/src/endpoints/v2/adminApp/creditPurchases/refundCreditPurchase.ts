import { z } from "zod";
import { CreditPurchaseUidSchema } from "../../../../core/uids";
import { CentsSchema } from "../../../../core/money";

/**
 * `POST /v2/admin/credit-purchases/:uid/refund` — refund (part of) a completed
 * advertiser credit purchase back to the card. Locks the amount out of the
 * advertiser's available budget (CREDIT_PURCHASE_REFUND_LOCK), then issues the
 * Stripe refund; the `refund.succeeded` webhook books the final
 * CREDIT_PURCHASE_REFUND and flips the purchase status. PAYG charges are
 * non-refundable, and the amount is capped at both the purchase's not-yet-
 * refunded remainder and the advertiser's current available budget.
 */
export const AdminCreditPurchaseUidParamsSchema = z.object({
  uid: CreditPurchaseUidSchema,
});
export type AdminCreditPurchaseUidParams = z.infer<
  typeof AdminCreditPurchaseUidParamsSchema
>;

export const AdminRefundCreditPurchaseBodySchema = z.object({
  amountCents: z.number().int().min(1, "Amount must be at least 1 cent"),
  reason: z.string().max(500).optional(),
});
export type AdminRefundCreditPurchaseBody = z.infer<
  typeof AdminRefundCreditPurchaseBodySchema
>;

export const AdminRefundCreditPurchaseResponseSchema = z.object({
  message: z.string(),
  creditPurchaseUid: CreditPurchaseUidSchema,
  refundedCents: CentsSchema,
  maxRefundableCents: CentsSchema,
  newAvailableBudgetCents: CentsSchema,
  stripeRefundId: z.string(),
});
export type AdminRefundCreditPurchaseResponse = z.infer<
  typeof AdminRefundCreditPurchaseResponseSchema
>;
