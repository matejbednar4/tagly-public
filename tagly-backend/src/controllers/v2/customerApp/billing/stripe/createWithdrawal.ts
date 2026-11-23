import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../../prisma/prisma.js";
import type {
  CreateWithdrawalBody,
  CreateWithdrawalResponse,
} from "@tagly/models/v2/customerApp";
import { withdrawCustomerBalanceToConnectOrThrow } from "../../../../../utils/money/withdrawals/withdrawCustomerBalanceToConnectOrThrow.js";
import { assertCustomerNotBannedOrThrow } from "../../../../../utils/customers/assertCustomerNotBannedOrThrow.js";
import { deriveWithdrawalDisplayState } from "../../../../../utils/hydrators/billing/deriveWithdrawalDisplayState.js";

/**
 * `POST /v2/customers/me/cash-out/withdraw` — cash out the customer's Tagly
 * balance to their Stripe Connect account.
 *
 * Flow (all in `withdrawCustomerBalanceToConnectOrThrow`):
 * 1. Ensures the Connect account is on a manual payout schedule (platform-owned).
 * 2. Locks funds in the customer balance via a ledger event.
 * 3. Creates a Stripe Transfer to move funds to the Connect account.
 * 4. Records the withdrawal ledger event to finalize the debit.
 * 5. Creates the standard payout to the bank inline (best-effort; the stripe
 *    worker retries it if the funds aren't yet available on the account).
 * If the transfer fails, the locked funds are released back to the balance.
 * Payout status settles later via webhooks (payout.paid / payout.failed), with
 * the stripe reconciliation worker as a backstop.
 *
 * Returns the withdrawal collapsed to its customer-facing `WithdrawalDisplayState`
 * (freshly created → PROCESSING), matching the money feed. BANNED customers can't
 * withdraw (`assertCustomerNotBannedOrThrow`, mapped to a friendly client alert).
 */
export const createWithdrawal: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { amountCents } = req.validatedBody as CreateWithdrawalBody;
    const forcedCurrency = "usd";

    // BANNED customers cannot withdraw their balance.
    await assertCustomerNotBannedOrThrow(customerId);

    const result = await withdrawCustomerBalanceToConnectOrThrow({
      customerId,
      amountCents,
      currency: forcedCurrency,
      purpose: "customer_withdrawal",
      requirePayoutsEnabledAt: true,
    });

    const withdrawal = await prisma.stripeWithdrawal.findUniqueOrThrow({
      where: { id: result.withdrawalId },
      select: {
        uid: true,
        amountCents: true,
        status: true,
        payoutStatus: true,
        payoutAttempts: true,
        nextPayoutRetryAt: true,
        createdAt: true,
        currency: true,
      },
    });

    // No "withdrawal initiated" notification (removed 2026-07-25): the
    // customer just performed the action in-app and is looking at the result.
    // The meaningful moments are `c.balance.withdrawal-completed` / `-failed`.

    return res.status(201).json({
      withdrawal: {
        uid: withdrawal.uid,
        amountCents: Number(withdrawal.amountCents),
        state: deriveWithdrawalDisplayState({
          status: withdrawal.status,
          payoutStatus: withdrawal.payoutStatus,
          payoutAttempts: withdrawal.payoutAttempts,
          nextPayoutRetryAt: withdrawal.nextPayoutRetryAt,
        }),
        createdAt: withdrawal.createdAt.toISOString(),
      },
    } satisfies CreateWithdrawalResponse);
  },
);
