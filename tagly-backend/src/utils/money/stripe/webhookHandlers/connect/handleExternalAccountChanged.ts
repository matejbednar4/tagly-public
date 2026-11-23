import type { Prisma } from "../../../../../generated/prisma/client.js";
import type Stripe from "stripe";
import { scheduleImmediatePayoutRetryForAccount } from "../../../withdrawals/withdrawalTransitions.js";

/**
 * `account.external_account.created` / `account.external_account.updated` — the
 * customer just added or fixed the bank account behind their Connect payouts.
 *
 * This is the retry trigger the payouts-enabled edge can't provide: a wrong
 * account number makes payouts FAIL without ever disabling payouts on the
 * account, so `handleConnectAccountUpdated`'s disabled→enabled edge never fires
 * for the most common fix. A changed external account is a direct, user-driven
 * "I fixed my bank" signal, so every stuck withdrawal on the account
 * (FAILED/CANCELED payout, or a settled row whose payout create kept being
 * rejected — including parked ones, per the D4 amendment) is re-armed for an
 * immediate attempt.
 *
 * Deliberately keyed on `event.account` alone — no customer lookup — so it also
 * re-arms orphaned account-deletion sweeps (the ex-customer can still fix their
 * bank via Stripe's own emails/flows after their Tagly account is gone).
 *
 * Bounded: each event is a real user action, and each re-arm grants exactly one
 * attempt (another failure re-parks + re-alerts), so this cannot create a retry
 * loop. No customer notification — the outcome notifies via payout.paid/failed.
 */
export async function handleExternalAccountChanged(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
): Promise<void> {
  const stripeAccountId = event.account;
  if (!stripeAccountId) return;

  await scheduleImmediatePayoutRetryForAccount(tx, {
    stripeAccountId,
  });
}
