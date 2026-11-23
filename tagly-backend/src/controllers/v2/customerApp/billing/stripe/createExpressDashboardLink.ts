import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { stripe } from "../../../../../utils/clients/stripe.js";
import type { CreateExpressDashboardLinkResponse } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/cash-out/dashboard-link` — one-time login link to the
 * customer's Stripe Express Dashboard.
 *
 * Lets customers view payout history and update banking details directly in
 * Stripe's Express Dashboard. Requires an existing Connect account.
 */
export const createExpressDashboardLink: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        sensitiveData: {
          select: {
            stripeConnectId: true,
          },
        },
      },
    });

    if (!customer?.sensitiveData?.stripeConnectId) {
      throw createCustomError(1712, "stripe account not found", 404);
    }

    const loginLink = await stripe.accounts.createLoginLink(
      customer.sensitiveData.stripeConnectId,
    );

    res.status(200).json({
      url: loginLink.url,
    } satisfies CreateExpressDashboardLinkResponse);
  },
);
