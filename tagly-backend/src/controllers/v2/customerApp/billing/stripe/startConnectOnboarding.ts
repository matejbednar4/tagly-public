import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { envVariables } from "../../../../../environment/envVariables.js";
import { stripe } from "../../../../../utils/clients/stripe.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { ensureStripeExpressAccountForCustomer } from "../../../../../utils/money/stripe/ensureStripeExpressAccountForCustomer.js";
import type { StartConnectOnboardingResponse } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/cash-out/onboarding` — start Stripe Connect Express
 * onboarding.
 *
 * Creates (or reuses) the customer's Stripe Express account, then generates a
 * hosted Account Link for KYC and returns its URL. The customer is redirected
 * back to the app via the return_url/refresh_url after completing/abandoning.
 */
export const startConnectOnboarding: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;

    const stripeAccountId =
      await ensureStripeExpressAccountForCustomer(customerId);

    // Return to `/customer/withdraw` → the redirect page bounces to
    // `tagly://withdraw`, landing the user back on the withdraw screen.
    const baseUrl = new URL(envVariables.CUSTOMER_APP_WITHDRAW_RETURN_URI);
    baseUrl.searchParams.set("account", stripeAccountId);

    let link;
    try {
      link = await stripe.accountLinks.create({
        account: stripeAccountId,
        type: "account_onboarding",
        return_url: baseUrl.toString(),
        refresh_url: baseUrl.toString(),
      });
    } catch {
      throw createCustomError(1718, "failed to create onboarding link", 502);
    }

    // Convert Unix timestamp to ISO string for the response schema
    const expiresAt = new Date(link.expires_at * 1000).toISOString();

    return res.status(200).json({
      stripeAccountId,
      url: link.url,
      expiresAt,
    } satisfies StartConnectOnboardingResponse);
  },
);
