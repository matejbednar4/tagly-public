import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { removeSavedCard as removeSavedCardOrThrow } from "../../../../../utils/money/savedCard/removeSavedCard.js";
import { bumpAdvertiserBudgetGen } from "../../../../../utils/pricing/rewardEstCache.js";
import type { RemoveSavedCardResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `DELETE /v2/advertisers/me/billing/payment-method` — unlink the account's
 * saved off-session card. The card is shared by both card-charging features,
 * so this closes BOTH periods (`removeSavedCard`: PAYG + monthly budget,
 * reason `CARD_REMOVED`) and detaches the card at Stripe. Turning a single
 * feature off while keeping the card is that feature's own `DELETE`
 * (`disablePayg` / `disableMonthlyBudget`).
 *
 * Any in-flight PAYG shares (PROCESSING) are left as-is. When the settlement
 * worker picks them up it will find no card on file and immediately settle
 * them with allowNegativeAdvertiserBalance — the customer is paid in full and
 * the advertiser's balance goes negative. This is simpler and more reliable
 * than a convert-then-charge approach, which would block card removal
 * whenever the card was already declining.
 *
 * `offSessionChargeAuthorizedAt` is kept — it's a durable consent record, not
 * tied to the card. Error 1338 when there is no card to remove.
 */
export const removeSavedCard: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;

    const { closedPayg } = await removeSavedCardOrThrow(advertiserId);

    // PAYG just went inactive → this advertiser's estimates may now be
    // budget-capped. No ledger event fired, so bump the estimate cache explicitly.
    // Fire-and-forget, fail-open.
    if (closedPayg) void bumpAdvertiserBudgetGen(advertiserId).catch(() => {});

    res.status(200).json({ hasCard: false } satisfies RemoveSavedCardResponse);
  },
);
