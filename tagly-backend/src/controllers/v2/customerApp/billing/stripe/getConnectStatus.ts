import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { stripe } from "../../../../../utils/clients/stripe.js";
import type {
  GetConnectStatusQuery,
  GetConnectStatusResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `GET /v2/customers/me/cash-out/connect-status` — the customer's Stripe Connect
 * payout readiness, driving the cash-out screen's 3-state machine.
 *
 * When no Connect account exists yet, returns `{ hasAccount: false }` (rather than
 * erroring) so the client can show the region gate — the customer can still
 * self-serve switch US↔CZ before we ever create the account (its country is locked
 * by Stripe at creation).
 *
 * **Reads are cheap by default.** `payoutsEnabledAt` is kept fresh by the
 * `account.updated` webhook (`handleConnectAccountUpdated` sets it on enable,
 * clears it on disable), so we just return the stored value — no ~600ms Stripe
 * round-trip per poll. `?sync=true` forces a live `accounts.retrieve` + reconcile;
 * the client uses it right after onboarding so completion is caught immediately
 * even if the webhook lags. A non-null value means the customer can cash out.
 */
export const getConnectStatus: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;
    const { sync } = req.validatedQuery as GetConnectStatusQuery;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        sensitiveData: {
          select: {
            id: true,
            stripeConnectId: true,
            payoutsEnabledAt: true,
          },
        },
      },
    });

    const sensitive = customer?.sensitiveData;
    if (!sensitive?.stripeConnectId) {
      // No Connect account yet — not an error; the client shows the region gate.
      return res.status(200).json({
        hasAccount: false,
        payoutsEnabledAt: null,
      } satisfies GetConnectStatusResponse);
    }

    // Default: serve the webhook-maintained DB value (no Stripe call).
    if (!sync) {
      return res.status(200).json({
        hasAccount: true,
        payoutsEnabledAt: sensitive.payoutsEnabledAt?.toISOString() ?? null,
      } satisfies GetConnectStatusResponse);
    }

    // sync=true: authoritative live reconcile with Stripe.
    let acct;
    try {
      acct = await stripe.accounts.retrieve(sensitive.stripeConnectId);
    } catch {
      throw createCustomError(1715, "stripe retrieve failed", 502);
    }

    let newPayoutsEnabledAt = sensitive.payoutsEnabledAt ?? null;
    if (acct.payouts_enabled && !sensitive.payoutsEnabledAt) {
      newPayoutsEnabledAt = new Date();
    } else if (!acct.payouts_enabled && sensitive.payoutsEnabledAt) {
      newPayoutsEnabledAt = null;
    }

    if (newPayoutsEnabledAt !== sensitive.payoutsEnabledAt) {
      await prisma.customerSensitiveData.update({
        where: { id: sensitive.id },
        data: { payoutsEnabledAt: newPayoutsEnabledAt },
      });
    }

    res.status(200).json({
      hasAccount: true,
      payoutsEnabledAt: newPayoutsEnabledAt?.toISOString() ?? null,
    } satisfies GetConnectStatusResponse);
  },
);
