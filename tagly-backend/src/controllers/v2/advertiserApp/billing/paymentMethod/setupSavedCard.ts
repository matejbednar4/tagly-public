import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { STRIPE_PAYMENT_PURPOSE } from "../../../../../utils/money/stripe/paymentMetadataPurpose.js";
import { createOffSessionCardSetupIntent } from "../../../../../utils/money/stripe/createOffSessionCardSetupIntent.js";
import type {
  SetupSavedCardBody,
  SetupSavedCardResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/billing/payment-method/setup-intent` — start
 * linking (or replacing) the account's saved off-session card WITHOUT turning
 * any feature on. The purpose-neutral twin of `setupPaygCard`: identical
 * SetupIntent + consent stamp (shared `createOffSessionCardSetupIntent`), but
 * stamped `purpose: card_setup`, so `reconcileSavedCard` / the webhook save
 * the card only — no PaygPeriod. Used when the card is added for the monthly
 * budget.
 */
export const setupSavedCard: RequestHandler = asyncHandler(async (req, res) => {
  // `chargeAuthorized` is validated as z.literal(true) by the route schema, so
  // reaching here means the advertiser explicitly agreed.
  const {} = req.validatedBody as SetupSavedCardBody;

  const intent = await createOffSessionCardSetupIntent(
    req.user.id,
    STRIPE_PAYMENT_PURPOSE.CARD_SETUP,
  );

  res.status(201).json(intent satisfies SetupSavedCardResponse);
});
