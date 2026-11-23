import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../../prisma/prisma.js";
import { deriveMonthlyBudgetStatus } from "../../../../../utils/hydrators/billing/deriveMonthlyBudgetStatus.js";
import type { z } from "zod";
import type { GetMonthlyBudgetResponseSchema } from "@tagly/models/v2/advertiserApp";

/**
 * `GET /v2/advertisers/me/billing/monthly-budget` — the full monthly-budget
 * state backing the MonthlyBudgetSheet (status, target, next charge, pending
 * retry, last end reason, card on file). Pure DB read, no Stripe call — the
 * twin of `getPaygState`. The latest period tells both facts: open (endedAt
 * null) = active; closed = its endedReason is the "why it stopped".
 *
 * The response carries Zod-input values (raw Date / bigint — hence
 * `z.input` below, not the inferred output type); the JSON serializer + the
 * SDK's response schema coerce them to the wire shape.
 */
export const getMonthlyBudget: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;

    const adv = await prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: {
        sensitiveData: { select: { savedPaymentMethodId: true } },
        monthlyBudgetPeriods: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            endedAt: true,
            endedReason: true,
            targetCents: true,
            nextRunAt: true,
            chargeAttempts: true,
          },
        },
      },
    });
    if (!adv) throw createCustomError(1304, "advertiser not found", 404);

    const latest = adv.monthlyBudgetPeriods[0] ?? null;
    const active = latest != null && latest.endedAt === null;
    const hasCard = adv.sensitiveData.savedPaymentMethodId != null;
    const lastEndedReason = latest?.endedReason ?? null;

    res.status(200).json({
      status: deriveMonthlyBudgetStatus({
        cardOnFile: hasCard,
        periodOpen: active,
        lastEndedReason,
      }),
      active,
      targetCents: active ? latest.targetCents : null,
      nextChargeAt: active ? latest.nextRunAt : null,
      pendingRetry: active && latest.chargeAttempts > 0,
      lastEndedReason,
      hasCard,
    } satisfies z.input<typeof GetMonthlyBudgetResponseSchema>);
  },
);
