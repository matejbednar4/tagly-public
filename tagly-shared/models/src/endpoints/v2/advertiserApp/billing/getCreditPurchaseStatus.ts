import { z } from "zod";
import { CreditPurchaseUidSchema } from "../../../../core/uids";

/**
 * `GET /v2/advertisers/me/billing/credit-purchases/:uid` — read the current
 * status of one of the advertiser's own credit purchases. Pure read of the
 * purchase row; crediting stays webhook-driven. The client polls this right
 * after the PaymentSheet succeeds to verify the webhook actually booked the
 * credits before showing success (and falls back to a "we couldn't verify"
 * state if it doesn't land in time).
 */
export const GetCreditPurchaseStatusParamsSchema = z.object({
  uid: CreditPurchaseUidSchema,
});
export type GetCreditPurchaseStatusParams = z.infer<
  typeof GetCreditPurchaseStatusParamsSchema
>;

/**
 * The purchase's lifecycle collapsed to what a paying client needs: the DB's
 * refund states count as COMPLETED (the payment itself went through), and
 * CANCELED counts as FAILED.
 */
export const CreditPurchasePollStatusSchema = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED",
]);
export type CreditPurchasePollStatus = z.infer<
  typeof CreditPurchasePollStatusSchema
>;

export const GetCreditPurchaseStatusResponseSchema = z.object({
  status: CreditPurchasePollStatusSchema,
});
export type GetCreditPurchaseStatusResponse = z.infer<
  typeof GetCreditPurchaseStatusResponseSchema
>;
