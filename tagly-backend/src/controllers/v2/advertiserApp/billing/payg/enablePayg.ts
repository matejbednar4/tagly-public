import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { isCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { openPaygPeriod } from "../../../../../utils/money/payg/openPaygPeriod.js";
import { bumpAdvertiserBudgetGen } from "../../../../../utils/pricing/rewardEstCache.js";
import type {
  EnablePaygBody,
  EnablePaygResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/billing/payg` — turn pay-as-you-go on with the
 * saved card already on file. Before the card was shared with the monthly
 * budget, PAYG could only start by linking a card (`/payg/setup-intent` +
 * `/payg/reconcile`, which opens the period as a side effect); now an
 * advertiser can hold a card without PAYG (linked for the monthly budget, or
 * PAYG turned off via `disablePayg`), so "turn it on" needs its own action.
 *
 * Opens the period (idempotent — a no-op when already open) inside the same
 * transaction that re-stamps the off-session consent. `openPaygPeriod`'s
 * card-on-file invariant surfaces as 1350 (the monthly budget's "no saved
 * card" code — same meaning: link a card first).
 */
export const enablePayg: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;
  // `chargeAuthorized` is validated as z.literal(true) by the route schema.
  const {} = req.validatedBody as EnablePaygBody;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.advertiserSensitiveData.updateMany({
        where: { advertiser: { is: { id: advertiserId } } },
        data: { offSessionChargeAuthorizedAt: new Date() },
      });
      await openPaygPeriod(advertiserId, tx);
    });
  } catch (err) {
    // openPaygPeriod's guard is a 1342 (its historical code); re-map to the
    // client-facing "link a card first" code the monthly budget also uses.
    if (isCustomError(err) && err.error.code === 1342) {
      throw createCustomError(
        1350,
        "cannot turn pay-as-you-go on without a saved card on file",
        400,
      );
    }
    throw err;
  }

  // PAYG just went active → estimates for this advertiser's businesses are no
  // longer budget-capped. No ledger event fired, so bump the estimate cache
  // explicitly. Fire-and-forget, fail-open.
  void bumpAdvertiserBudgetGen(advertiserId).catch(() => {});

  res.status(200).json({ active: true } satisfies EnablePaygResponse);
});
