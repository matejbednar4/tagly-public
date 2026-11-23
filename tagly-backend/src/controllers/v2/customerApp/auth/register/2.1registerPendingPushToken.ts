import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../../utils/core/errors/createCustomError.js";
import { upsertPushToken } from "../../../../../utils/notifications/upsertPushToken.js";
import type {
  RegisterPendingPushTokenBody,
  RegisterPendingPushTokenResponse,
} from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/public/auth/customers/pending-push-token` — register an Expo push
 * token against a PendingCustomer (pre-registration nudges). The token migrates
 * to the Customer when registration completes.
 *
 * Goes through `upsertPushToken` so the upsert also (a) stamps `lastSeenAt` —
 * the "last active" signal the promo waterfall reads to skip the escalation
 * email after an app open — and (b) stores the device-reported `timezone`,
 * which quiet-hours scheduling needs to place nudges in the recipient's real
 * local morning (the locale fallback is only right in the market's home zone).
 */
export const registerPendingPushToken: RequestHandler = asyncHandler(
  async (req, res) => {
    const { registrationToken, token, timezone } =
      req.validatedBody as RegisterPendingPushTokenBody;

    const pending = await prisma.pendingCustomer.findUnique({
      where: { registrationToken },
      select: { id: true },
    });
    if (!pending) {
      throw createCustomError(2220, "Pending account not found", 404);
    }

    // Reassign this device token to the pending customer (clears every other
    // owner FK, re-enables a disabled token, stamps lastSeenAt) — but NEVER
    // steal a token that currently belongs to a signed-in real account.
    //
    // This endpoint is unauthenticated: a `registrationToken` is self-serve, so
    // anyone can obtain one by starting a registration. Without this guard,
    // a caller holding somebody else's Expo token could rebind that device —
    // the victim silently stops receiving their own notifications, and the
    // caller's pre-registration nudges get delivered to a stranger's phone.
    //
    // Skipping is deliberately soft (still a 200): the pre-registration nudge
    // is a nice-to-have, and the binding is re-established properly by the
    // AUTHENTICATED on-app-open once registration completes. The legitimate
    // "register a new account on this phone" flow is unaffected because
    // signing out stamps `disabledAt`, which this guard treats as claimable.
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
          { pendingCustomerId: pending.id },
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
