import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { upsertPushToken } from "../../../../../utils/notifications/upsertPushToken.js";
import type {
  RegisterPendingPushTokenBody,
  RegisterPendingPushTokenResponse,
} from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/public/auth/advertisers/pending-push-token` — register an Expo push
 * token against a PendingAdvertiserAccount (pre-registration nudges). The token
 * migrates to the Advertiser when registration completes.
 *
 * Goes through `upsertPushToken` so the upsert also stamps `lastSeenAt` and the
 * device-reported `timezone` (see the customer twin for why both matter to the
 * promo waterfall + quiet hours).
 */
export const registerPendingPushToken: RequestHandler = asyncHandler(
  async (req, res) => {
    const { registrationToken, token, timezone } =
      req.validatedBody as RegisterPendingPushTokenBody;

    const pending = await prisma.pendingAdvertiserAccount.findUnique({
      where: { registrationToken },
      select: { id: true },
    });
    if (!pending) {
      throw createCustomError(2320, "Pending account not found", 404);
    }

    // Reassign this device token to the pending advertiser (clears every other
    // owner FK, re-enables a disabled token, stamps lastSeenAt) — but NEVER
    // steal a token that currently belongs to a signed-in real account. This
    // endpoint is unauthenticated (a `registrationToken` is self-serve), so
    // without the guard anyone holding somebody else's Expo token could rebind
    // that device. See the customer twin for the full rationale.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.pushToken.findUnique({
        where: { token },
        select: { customerId: true, advertiserId: true, disabledAt: true },
      });
      const boundToActiveAccount =
        existing !== null &&
        existing.disabledAt === null &&
        (existing.customerId !== null || existing.advertiserId !== null);

      if (!boundToActiveAccount) {
        await upsertPushToken(
          token,
          { pendingAdvertiserId: pending.id },
          { timezone },
          tx,
        );
      }
    });

    res.status(200).json({
      message: "Push token registered",
    } satisfies RegisterPendingPushTokenResponse);
  },
);
