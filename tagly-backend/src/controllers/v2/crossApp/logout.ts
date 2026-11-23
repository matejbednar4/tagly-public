import type { RequestHandler } from "express";
import { asyncHandler } from "../../../utils/core/http/asyncHandler.js";
import type { LogOutBody, LogOutResponse } from "@tagly/models/v2/crossApp";
import { getEntityFromUid } from "../../../utils/core/uids/getEntityFromUid.js";
import prisma from "../../../prisma/prisma.js";

/**
 * `POST /v2/cross/logout` — the server-side half of logout. Authed by either
 * app's JWT (mounted under the `/v2/cross` group).
 *
 * Disables the supplied device push token for the acting entity, so a
 * logged-out device stops receiving this user's notifications. That is the
 * whole job: sessions are bearer JWTs held by the native apps, so there is no
 * server-side session to tear down — the client discards its own token.
 *
 * Best-effort and idempotent: no token, an unknown token, or an already-disabled
 * token all settle to a 200. The token disable is scoped by BOTH the token and
 * the acting entity's id, so it never touches another account's row (e.g. a
 * token the device already re-registered under a different user).
 */
export const logOut: RequestHandler = asyncHandler(async (req, res) => {
  const { pushToken } = req.validatedBody as LogOutBody;
  const { id, uid } = req.user;

  if (pushToken) {
    const entity = getEntityFromUid(uid);
    if (entity === "CUSTOMER") {
      await prisma.pushToken.updateMany({
        where: { customerId: id, token: pushToken, disabledAt: null },
        data: { disabledAt: new Date() },
      });
    } else if (entity === "ADVERTISER") {
      await prisma.pushToken.updateMany({
        where: { advertiserId: id, token: pushToken, disabledAt: null },
        data: { disabledAt: new Date() },
      });
    }
  }

  res.status(200).json({ message: "Logged out" } satisfies LogOutResponse);
});
