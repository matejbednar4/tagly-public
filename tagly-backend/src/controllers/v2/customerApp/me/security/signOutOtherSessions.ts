import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../../prisma/prisma.js";
import { issueSessionJwt } from "../../../../../utils/auth/issueSessionJwt.js";
import type { SignOutOtherSessionsResponse } from "@tagly/models/v2/customerApp";

/**
 * `POST /v2/customers/me/security/sign-out-others` — revoke every other session by
 * bumping the customer's `jwtVersion` (every token carrying the old version now
 * fails `verifyJwt` → 401), then re-issue THIS device a fresh token so the caller
 * stays signed in. The `verifyJwt` on this request already ran against the old
 * version, so the increment doesn't affect the in-flight request; the client
 * persists the returned token and uses it from the next request on.
 *
 * Keyed on `uid`, not on the numeric `req.user.id`, because this is the one
 * endpoint whose response IS a credential — it signs a session token from the
 * row it just read. `req.user.id` is a primary key in whichever table the uid's
 * prefix names, and those sequences are independent, so a principal of the
 * wrong type reaching this handler would bump an unrelated account's
 * `jwtVersion` and hand the caller a valid session for it. The capability gate
 * is what guarantees the type today; keying on the uid means this handler stays
 * safe on its own terms if that gate is ever widened again. A uid of the wrong
 * type matches no row (P2025 → 500) instead of writing the wrong one, and the
 * token's `id` claim comes from the matched row rather than from the caller.
 */
export const signOutOtherSessions: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.user;

    const updated = await prisma.customer.update({
      where: { uid },
      data: { jwtVersion: { increment: 1 } },
      select: { id: true, uid: true, jwtVersion: true },
    });

    const token = issueSessionJwt({
      id: updated.id,
      uid: updated.uid,
      jwtVersion: updated.jwtVersion,
    });

    res.status(200).json({ token } satisfies SignOutOtherSessionsResponse);
  },
);
