import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { upsertPushToken } from "../../../../utils/notifications/upsertPushToken.js";
import type { OnAppOpenBody } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/on-app-open` — fire-and-forget app-open side-effects
 * for the logged-in customer (runs for ALL users, IG-linked or not):
 *   1. Ensure notification-event defaults exist (idempotent + throttled inside
 *      the util). App-open is the home for this seeding, never GET /me.
 *   2. If the app reports OS notification permission OFF for this device,
 *      disable the device's stored push tokens — revoked permission does NOT
 *      invalidate an Expo token, so without this the backend keeps pushing into
 *      a void and the promo push-vs-email waterfall picks the dead channel.
 *   3. Otherwise register the device's Expo push token, if one was supplied —
 *      with its platform + vendor-scoped deviceId (functional push metadata).
 *      The upsert re-enables a previously disabled token and stamps
 *      `lastSeenAt` (the "last active" signal).
 *
 * Returns 204. The IG connection probe lives in `/me/instagram/refresh` so its
 * connection-state error codes don't entangle with these writes.
 */
export const onAppOpen: RequestHandler = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  const { pushToken, platform, deviceId, timezone, pushPermissionGranted } =
    req.validatedBody as OnAppOpenBody;

  if (pushPermissionGranted === false) {
    // Scope the disable to THIS device (deviceId, or the supplied token as a
    // fallback) — never the whole account, or one muted device would kill push
    // for every other device the customer still has permission on.
    const deviceScope = deviceId
      ? { deviceId }
      : pushToken
        ? { token: pushToken }
        : null;
    if (deviceScope) {
      await prisma.pushToken.updateMany({
        where: { customerId, disabledAt: null, ...deviceScope },
        data: { disabledAt: new Date() },
      });
    }
  } else if (pushToken) {
    // Binds the token to this customer and clears any other owner (the util
    // enforces the one-token-one-account invariant).
    await upsertPushToken(
      pushToken,
      { customerId },
      { platform, deviceId, timezone }
    );
  }

  res.status(204).end();
});
