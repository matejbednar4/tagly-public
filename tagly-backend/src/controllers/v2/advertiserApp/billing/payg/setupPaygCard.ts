import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { STRIPE_PAYMENT_PURPOSE } from "../../../../../utils/money/stripe/paymentMetadataPurpose.js";
import { createOffSessionCardSetupIntent } from "../../../../../utils/money/stripe/createOffSessionCardSetupIntent.js";
import type {
  SetupPaygCardBody,
  SetupPaygCardResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/billing/payg/setup-intent` — the legacy PAYG
 * card-link starter: a bare off-session SetupIntent + ephemeral key (shared
 * `createOffSessionCardSetupIntent`) stamped `purpose: payg_setup`, which
 * `linkCardFromSetupIntent` turns into "save the card AND open the
 * PaygPeriod".
 *
 * @deprecated back-compat: only app builds shipped before 2026-09 call this.
 * Current builds link the card with `setupSavedCard` (`card_setup`, feature-
 * agnostic) and turn PAYG on with `POST /payg` (`enablePayg`). Delete this
 * controller, its route, and the `payg_setup` branch in
 * `linkCardFromSetupIntent` once those builds roll off.
 */
export const setupPaygCard: RequestHandler = asyncHandler(async (req, res) => {
  // paygChargeAuthorizedAt is validated as z.literal(true) by the route schema,
  // so reaching here means the advertiser explicitly agreed.
  const {} = req.validatedBody as SetupPaygCardBody;

  const intent = await createOffSessionCardSetupIntent(
    req.user.id,
    STRIPE_PAYMENT_PURPOSE.PAYG_SETUP,
  );

  // No estimate-cache bump here: creating a setup intent doesn't change the
  // PAYG-active state — the reconcile (which opens the period) bumps.
  res.status(201).json(intent satisfies SetupPaygCardResponse);
});
