import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import { bumpBusinessRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import type {
  DeleteBusinessResponse,
  GetBusinessByUidParams,
} from "@tagly/models/v2/advertiserApp";

/**
 * `DELETE /v2/advertisers/me/businesses/:uid` — remove one of the
 * advertiser's own business pages. **Two-stage removal:**
 *
 * 1. Here: an atomic ACTIVE → DELETED flip. The page instantly disappears
 *    from every surface — customer reads gate on the canonical
 *    `businessVisible*` predicate (status ACTIVE), advertiser reads filter
 *    `not DELETED`, and `getMe.hasBusinessPage` flips on the next fetch.
 * 2. Later: the `deletedLocals` cleanup-worker rule hard-purges the row
 *    (media + S3 + address; shares de-link via `Share.localId` SetNull) once
 *    it has no in-flight share and the grace window has passed.
 *
 * In-flight shares are HONORED, not voided: the row survives until purge, so
 * the payout worker (which reads the local live at settlement) still settles
 * and pays them — that's the whole reason for the two stages.
 *
 * Guards: ownership is the update filter (IDOR-safe). Only ACTIVE pages
 * match — a BANNED page is admin's domain and already-DELETED is gone, both
 * 404. Platform-subsidized pages have `advertiserId: null`, so they can never
 * match an advertiser's delete. Deleting the last/only page is allowed.
 */
export const deleteBusiness: RequestHandler = asyncHandler(async (req, res) => {
  const advertiserId = req.user.id;
  const { uid } = req.validatedParams as GetBusinessByUidParams;

  // Need the id for the reward-est bump; the status flip below is the atomic
  // guard (CAS on ACTIVE), not this read.
  const local = await prisma.localSubaccount.findFirst({
    where: { uid, advertiserId },
    select: { id: true },
  });

  const flipped = await prisma.localSubaccount.updateMany({
    where: { uid, advertiserId, status: "ACTIVE" },
    data: { status: "DELETED" },
  });
  if (flipped.count === 0 || !local) {
    throw createCustomError(4604, "Business not found", 404);
  }

  // Cached reward estimates for the page die with it (best-effort, fails open).
  await bumpBusinessRewardEstGen(local.id).catch(() => {});

  res.status(200).json({ deleted: true } satisfies DeleteBusinessResponse);
});
