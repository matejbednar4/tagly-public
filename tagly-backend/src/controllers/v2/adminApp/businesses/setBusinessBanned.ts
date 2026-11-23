import type { RequestHandler } from "express";
import prisma from "../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import adminHydrateLocal from "../../../../utils/hydrators/admin/adminHydrateLocal.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import type {
  AdminBusinessUidParams,
  AdminSetBusinessBannedBody,
} from "@tagly/models/v2/adminApp";

/**
 * `PATCH /v2/admin/businesses/:uid/banned` — ban or unban a business page.
 * An atomic status CAS: the ban claim requires ACTIVE and the unban claim
 * requires BANNED, so a DELETED page can never be flipped to BANNED.
 *
 * Effects are purely visibility-side, by construction: BANNED pages are
 * customer-hidden everywhere (`businessVisibleWhere` gates on ACTIVE) and
 * inaccessible for new shares, while the owner still SEES the page
 * (`businessOwnerVisibleWhere`) with its BANNED status (view-only — the
 * advertiser write endpoints require ACTIVE). In-flight shares are untouched
 * and settle normally (no worker reads business status). No cache bump
 * (status is not a pricer input).
 *
 * The owner (if the page is advertiser-owned) is notified either way —
 * `a.business.banned` / `a.business.unbanned`, mandatory email. The visibility
 * reconciler deliberately skips banned-page transitions so this stays the one
 * notice.
 *
 * SUPER-gated in the router.
 */
export const setBusinessBanned: RequestHandler = asyncHandler(
  async (req, res) => {
    const { uid } = req.validatedParams as AdminBusinessUidParams;
    const { banned } = req.validatedBody as AdminSetBusinessBannedBody;

    // Atomic CAS — the status guard lives in the `where`, so a concurrent
    // flip (or a DELETED page) loses the claim instead of being clobbered.
    const claimed = await prisma.localSubaccount.updateMany({
      where: { uid, status: banned ? "ACTIVE" : "BANNED" },
      data: { status: banned ? "BANNED" : "ACTIVE" },
    });
    if (claimed.count === 0) {
      // Distinguish 404 vs wrong-state 409.
      const local = await prisma.localSubaccount.findUnique({
        where: { uid },
        select: { id: true },
      });
      if (!local) throw createCustomError(4043, "Business not found", 404);
      throw banned
        ? createCustomError(4614, "Business is not ACTIVE (already banned or deleted)", 409)
        : createCustomError(4615, "Business is not banned", 409);
    }

    const row = await prisma.localSubaccount.findUnique({
      where: { uid },
      select: { id: true, name: true, advertiserId: true },
    });
    if (!row) throw createCustomError(4043, "Business not found", 404);

    // Tell the owner (unowned/subsidized pages have no one to tell).
    // Best-effort, after the flip; deduped per page + direction + day.
    if (row.advertiserId !== null) {
      const day = new Date().toISOString().slice(0, 10);
      await queueNotificationJobs({
        advertiserIds: [row.advertiserId],
        eventSlug: banned ? "a.business.banned" : "a.business.unbanned",
        payload: { businessName: row.name },
        dedupeKey: `business-${banned ? "banned" : "unbanned"}-${row.id}-${day}`,
      });
    }

    const [business] = await adminHydrateLocal({ localIds: [row.id] });
    if (!business) throw createCustomError(4043, "Business not found", 404);

    // No `satisfies` — the hydrator emits the schema's INPUT shape.
    res.status(200).json({
      message: banned
        ? "Business banned successfully"
        : "Business unbanned successfully",
      business,
    });
  },
);
