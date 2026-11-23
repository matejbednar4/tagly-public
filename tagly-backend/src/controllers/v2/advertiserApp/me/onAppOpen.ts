import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { upsertPushToken } from "../../../../utils/notifications/upsertPushToken.js";
import type { OnAppOpenBody } from "@tagly/models/v2/advertiserApp";

/**
 * `POST /v2/advertisers/me/on-app-open` — fire-and-forget app-open side-effects
 * for the logged-in advertiser (twin of the customer endpoint):
 *   1. Ensure notification-event defaults exist (idempotent + throttled inside
 *      the util).
 *   2. If the app reports OS notification permission OFF for this device,
 *      disable the device's stored push tokens — revoked permission does NOT
 *      invalidate an Expo token, so without this the backend keeps pushing into
 *      a void and the promo push-vs-email waterfall picks the dead channel.
 *   3. Otherwise register the device's Expo push token, if one was supplied —
 *      with its platform + vendor-scoped deviceId (functional push metadata).
 *      This is the only post-onboarding token write, so it also covers Expo
 *      token rotation, permission granted after onboarding, and reinstalls; the
 *      upsert re-enables a previously disabled token and stamps `lastSeenAt`.
 *
 * Returns 204.
 */
export const onAppOpen: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;
  const { pushToken, platform, deviceId, timezone, pushPermissionGranted } =
    req.validatedBody as OnAppOpenBody;

  if (pushPermissionGranted === false) {
    // Scope the disable to THIS device (deviceId, or the supplied token as a
    // fallback) — never the whole account, or one muted device would kill push
    // for every other device the advertiser still has permission on.
    const deviceScope = deviceId
      ? { deviceId }
      : pushToken
        ? { token: pushToken }
        : null;
    if (deviceScope) {
      await prisma.pushToken.updateMany({
        where: { advertiserId, disabledAt: null, ...deviceScope },
        data: { disabledAt: new Date() },
      });
    }
  } else if (pushToken) {
    // Binds the token to this advertiser and clears any other owner (the util
    // enforces the one-token-one-account invariant).
    await upsertPushToken(
      pushToken,
      { advertiserId },
      { platform, deviceId, timezone }
    );
  }

  res.status(204).end();
});
