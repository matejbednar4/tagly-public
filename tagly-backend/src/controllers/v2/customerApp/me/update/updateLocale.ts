import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import type {
  UpdateLocaleBody,
  UpdateLocaleResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/update/locale` — self-serve region correction (US↔CZ).
 *
 * Fixes a mis-derived `locale` (e.g. a CZ customer auto-assigned `US` by
 * `suggestLocale`) so their Stripe Express account is created in the right country
 * and they can attach their real bank. Both values are already validated to
 * `US | CZ` by the body schema.
 *
 * **Guard (financial-adjacent):** a Stripe Express account's country is permanently
 * locked at creation, from the locale at that moment. Once a Connect account exists
 * we must NOT change the locale — it would desync the profile from the (immutable)
 * payout country. In that case we reject with 1721 and the client routes the user
 * to support (who can delete + recreate the still-empty Connect account if needed).
 *
 * Only the `locale` field changes; marketing consent is deliberately left as-is
 * (a region correction is not a consent event).
 */
export const updateLocale: RequestHandler = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const { locale } = req.validatedBody as UpdateLocaleBody;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      locale: true,
      sensitiveData: { select: { stripeConnectId: true } },
    },
  });
  if (!customer) {
    throw createCustomError(1711, "customer not found", 404);
  }

  if (customer.sensitiveData?.stripeConnectId) {
    throw createCustomError(
      1721,
      "payout account already created; contact support to change region",
      409,
    );
  }

  if (customer.locale !== locale) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { locale },
    });
  }

  res.status(200).json({ locale } satisfies UpdateLocaleResponse);
});
