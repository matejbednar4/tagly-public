import type { Prisma } from "../../../../../generated/prisma/client.js";
import type Stripe from "stripe";
import type { ConnectPayoutResult } from "../types.js";
import { handlePayoutNotPaid } from "./handlePayoutNotPaid.js";

/**
 * `payout.failed` — the bank rejected the payout and Stripe returned the funds to
 * the customer's Connect balance. See `handlePayoutNotPaid` for the shared logic
 * (both purposes, uid lookup, per-withdrawal notify, retry scheduling, D4
 * exhaustion signal).
 */
export async function handlePayoutFailed(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
): Promise<ConnectPayoutResult> {
  return handlePayoutNotPaid(tx, event, "FAILED");
}
