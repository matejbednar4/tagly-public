import { z } from "zod";
import { ISODateSchema } from "../../../../../core/time";

export const GetConnectStatusQuerySchema = z.object({
  // Default reads the DB `payoutsEnabledAt` (kept fresh by the account.updated
  // webhook) — cheap, no Stripe round-trip. `sync=true` forces a live Stripe
  // retrieve + reconcile; the client uses it right after onboarding so completion
  // is caught immediately even if the webhook lags.
  sync: z.coerce.boolean().optional(),
});
export type GetConnectStatusQuery = z.infer<typeof GetConnectStatusQuerySchema>;

// Drives the cash-out screen's 3-state machine:
//  - `!hasAccount`                    → no Connect account yet: show the region
//    gate (the customer may still self-serve switch US↔CZ before we create it).
//  - `hasAccount && !payoutsEnabledAt` → account exists (KYC pending or wrong
//    country, now locked by Stripe) → "continue setup"; region change = support.
//  - `payoutsEnabledAt` set           → payouts enabled, the customer can cash out.
export const GetConnectStatusResponseSchema = z.object({
  hasAccount: z.boolean(),
  payoutsEnabledAt: ISODateSchema.nullable(),
});
export type GetConnectStatusResponse = z.infer<
  typeof GetConnectStatusResponseSchema
>;
