import { z } from "zod";
import { CreateCreditPurchaseResponseSchema } from "./createCreditPurchase";

/**
 * `POST /v2/advertisers/me/billing/settle-balance` — pay off a negative
 * available balance (an uncollectable PAYG receivable that made the account
 * invisible). It's a server-amount credit purchase: no request body (the amount
 * is the debt, computed server-side and floored at Stripe's minimum), and the
 * same PaymentSheet handoff as `createCreditPurchase` plus the charged
 * `amountCents` so the sheet can show what's being paid. Crediting stays
 * webhook-driven (`payment_intent.succeeded`), identical to a normal top-up.
 */
export const SettleNegativeBalanceResponseSchema =
  CreateCreditPurchaseResponseSchema.extend({
    /** The USD-cent amount actually charged (the debt, floored at the Stripe min). */
    amountCents: z.number().int().positive(),
  });
export type SettleNegativeBalanceResponse = z.infer<
  typeof SettleNegativeBalanceResponseSchema
>;
