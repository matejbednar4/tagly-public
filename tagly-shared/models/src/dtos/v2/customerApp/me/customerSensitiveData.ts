import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";

/**
 * Customer money + payout state, nested under `CustomerMe` (mirrors the
 * `CustomerSensitiveData` DB relation). v2 wire — drops the deprecated
 * `balanceCents` alias; `balanceUsdCents` is the single canonical balance.
 */
export const CustomerSensitiveDataSchema = z.object({
  balanceUsdCents: CentsSchema,
  /** Funds reserved against in-flight withdrawals — not spendable until they settle. */
  lockedBalanceUsdCents: CentsSchema,
  multiplierBps: z.number(),
  /** When Stripe Connect payouts became enabled, or null if not yet. */
  payoutsEnabledAt: ISODateSchema.nullable(),
  stripeConnectId: z.string().nullable(),
});

export type CustomerSensitiveData = z.infer<typeof CustomerSensitiveDataSchema>;
