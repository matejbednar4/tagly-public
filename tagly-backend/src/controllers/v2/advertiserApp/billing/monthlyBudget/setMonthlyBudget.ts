import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../../prisma/prisma.js";
import { openMonthlyBudgetPeriod } from "../../../../../utils/money/monthlyBudget/openMonthlyBudgetPeriod.js";
import type {
  SetMonthlyBudgetBody,
  SetMonthlyBudgetResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `PUT /v2/advertisers/me/billing/monthly-budget` — set the monthly budget to
 * `targetCents`.
 *
 * Periods are immutable, so this is always "open a period at X": enabling
 * opens the first one; a different target closes the open one
 * (`TARGET_CHANGED`) and opens a new one; the same target is a no-op.
 *
 * **Nothing here moves money, now or later in the request.** A new period is
 * scheduled for the next 1st at `CHARGE_HOUR_UTC`, and the stripe worker is the
 * only thing that ever runs one (`runMonthlyBudgetTopUp`). So the response is
 * immediate and final — there is no run for the app to wait for, which is why
 * the client no longer polls `GET /monthly-budget` after this call.
 *
 * `openMonthlyBudgetPeriod` (saved-card invariant → 1350) and the re-stamp of
 * the off-session consent — a fresh authorisation of a recurring charge —
 * share one transaction. The response only confirms the period is open (the
 * twin of `enablePayg`).
 */
export const setMonthlyBudget: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    // `chargeAuthorized` is validated as z.literal(true) by the route schema.
    const { targetCents } = req.validatedBody as SetMonthlyBudgetBody;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await openMonthlyBudgetPeriod(advertiserId, BigInt(targetCents), now, tx);
      await tx.advertiserSensitiveData.updateMany({
        where: { advertiser: { is: { id: advertiserId } } },
        data: { offSessionChargeAuthorizedAt: now },
      });
    });

    res.status(200).json({ active: true } satisfies SetMonthlyBudgetResponse);
  },
);
