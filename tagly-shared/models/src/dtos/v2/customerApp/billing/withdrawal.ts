import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";
import { WithdrawalUidSchema } from "../../../../core/uids";
import { WithdrawalDisplayStateSchema } from "../../../../core/enums";

/**
 * One customer withdrawal, collapsed to the customer-facing `WithdrawalDisplayState`
 * (never the raw, overloaded `StripeWithdrawal.status`) via
 * `deriveWithdrawalDisplayState` on the backend. Returned by the create + status
 * endpoints so the cash-out screen can render "processing / delayed / paid out /
 * failed / reversed" without knowing the raw Stripe transfer→payout lifecycle.
 * Mirrors the `withdrawal` variant of `CustomerTransaction` in the money feed.
 *
 * `amountCents` is the positive magnitude (the client renders it as money out).
 */
export const CustomerWithdrawalSchema = z.object({
  uid: WithdrawalUidSchema,
  amountCents: CentsSchema,
  state: WithdrawalDisplayStateSchema,
  createdAt: ISODateSchema,
});

export type CustomerWithdrawal = z.infer<typeof CustomerWithdrawalSchema>;
