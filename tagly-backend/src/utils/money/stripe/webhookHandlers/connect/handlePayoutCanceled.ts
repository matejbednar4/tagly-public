import type { Prisma } from "../../../../../generated/prisma/client.js";
import type Stripe from "stripe";
import type { ConnectPayoutResult } from "../types.js";
import { handlePayoutNotPaid } from "./handlePayoutNotPaid.js";

/**
 * `payout.canceled` — a manual payout was canceled before reaching the bank;
 * money-wise identical to a failed payout (funds stay on the Connect balance,
 * W-5). See `handlePayoutNotPaid` for the shared logic.
 */
export async function handlePayoutCanceled(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
): Promise<ConnectPayoutResult> {
  return handlePayoutNotPaid(tx, event, "CANCELED");
}
