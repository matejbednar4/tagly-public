import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { derivePaygStatus } from "../../../../../utils/hydrators/billing/derivePaygStatus.js";
import type { GetPaygStateResponse } from "@tagly/models/v2/advertiserApp";

/**
 * `GET /v2/advertisers/me/billing/payg` — the pay-as-you-go state backing the
 * PaygSheet's manage view: is a period open, why the last one closed, and the
 * derived status. PAYG has no spend cap. Pure DB read, no Stripe call.
 *
 * `hasCard` stays (a null check on the shared saved card — shipped sheets pick
 * manage-vs-link mode from it); the card's details are NOT here any more
 * (`card` is a `@deprecated`, always-null field) — they're on
 * `GET /billing/payment-method`, the one endpoint that talks to Stripe.
 */
export const getPaygState: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;

  const adv = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: {
      sensitiveData: {
        select: { savedPaymentMethodId: true },
      },
      // Latest period tells both facts: open (endedAt null) = active; closed =
      // its endedReason is the "why it stopped" (CHARGE_FAILED → prompt relink).
      paygPeriods: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { endedAt: true, endedReason: true },
      },
    },
  });
  if (!adv) throw createCustomError(1304, "advertiser not found", 404);

  const latestPeriod = adv.paygPeriods[0] ?? null;
  const active = latestPeriod != null && latestPeriod.endedAt === null;
  const cardOnFile = adv.sensitiveData.savedPaymentMethodId != null;

  res.status(200).json({
    hasCard: cardOnFile,
    // @deprecated back-compat: always null — see the DTO.
    card: null,
    active,
    status: derivePaygStatus({
      cardOnFile,
      periodOpen: active,
      lastEndedReason: latestPeriod?.endedReason ?? null,
    }),
    lastEndedReason: latestPeriod?.endedReason ?? null,
  } satisfies GetPaygStateResponse);
});
