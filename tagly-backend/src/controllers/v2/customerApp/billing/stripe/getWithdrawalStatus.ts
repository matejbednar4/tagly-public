import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../../prisma/prisma.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import type {
  GetWithdrawalStatusQuery,
  GetWithdrawalStatusResponse,
} from "@tagly/models/v2/customerApp";
import { deriveWithdrawalDisplayState } from "../../../../../utils/hydrators/billing/deriveWithdrawalDisplayState.js";

/**
 * `GET /v2/customers/me/cash-out/withdrawal-status?withdrawalUid=…` — the
 * single-withdrawal "did my cash-out work?" poll.
 *
 * Returns the withdrawal collapsed to its customer-facing `WithdrawalDisplayState`
 * (processing / delayed / paid out / failed / reversed) via
 * `deriveWithdrawalDisplayState`, never the raw overloaded `status`.
 *
 * IDOR protection: the lookup is filtered by `customerId`, so a customer can only
 * read their own withdrawals.
 */
export const getWithdrawalStatus: RequestHandler = asyncHandler(
  async (req, res) => {
    const { withdrawalUid } = req.validatedQuery as GetWithdrawalStatusQuery;
    const customerId = req.user.id;

    const withdrawal = await prisma.stripeWithdrawal.findFirst({
      where: { uid: withdrawalUid, customerId },
      select: {
        uid: true,
        amountCents: true,
        status: true,
        payoutStatus: true,
        payoutAttempts: true,
        nextPayoutRetryAt: true,
        createdAt: true,
      },
    });

    if (!withdrawal) {
      throw createCustomError(4622, "withdrawal not found", 404);
    }

    return res.status(200).json({
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
    } satisfies GetWithdrawalStatusResponse);
  },
);
