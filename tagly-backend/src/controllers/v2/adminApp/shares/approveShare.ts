import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import { lockBudgetForShare } from "../../../../utils/money/ledger/events/sharePayment/lockBudgetForShare.js";
import { PENDING_ADMIN_APPROVAL_WHERE } from "../../../../utils/shares/shareAccess.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import type { AdminApproveShareParams } from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/shares/:uid/approve` — intake-approve a PENDING share.
 *
 * Flow (see tagly-backend/CLAUDE.md §Share Approval Gate + docs/SHARE_LIFECYCLE.md):
 *   1. Guards: the share must exist, be `approvalStatus = PENDING`, AND still
 *      be `status = PROCESSING`. The PROCESSING guard (pre-check + the atomic
 *      claim) closes a trapped-funds race: a share voided to UNPAYABLE
 *      while pending (IG disconnect, insights/snapshot expiry) must never be
 *      approved — the lock placed here could then never be settled or
 *      released by the payment worker.
 *   2. Atomic CAS claim PENDING+PROCESSING → APPROVED (+ audit fields), then,
 *      in the SAME transaction, place the deferred budget lock by the
 *      immutable `fundingModeAtCreation`:
 *        - CREDITS    → advertiser budget, capped at the then-available amount
 *                       (`capAtAvailableBudget` — a thin budget yields a
 *                       partial lock instead of blocking approval).
 *        - SUBSIDIZED → platform pool (live Stripe balance checked).
 *        - PAYG       → lock-less (the card is charged at settlement).
 *      A lock failure (budget fully drained → 1516, platform too low → 1517)
 *      rolls the whole tx back — the share stays PENDING for retry/reject.
 *   3. After commit: notify the advertiser (`a.shares.created`) — the share
 *      only now enters their world. Best-effort by the queue's contract.
 */
export const approveShare: RequestHandler = asyncHandler(async (req, res) => {
  const adminId = req.user.id;
  const { uid } = req.validatedParams as AdminApproveShareParams;

  const share = await prisma.share.findUnique({
    where: { uid },
    select: {
      id: true,
      status: true,
      approvalStatus: true,
      advertiserId: true,
      fundingModeAtCreation: true,
      estimatedPriceCents: true,
      local: { select: { name: true } },
    },
  });
  if (!share) {
    throw createCustomError(4042, "Share not found", 404);
  }
  if (share.approvalStatus !== "PENDING") {
    throw createCustomError(4310, "Share is not pending approval", 409);
  }
  if (share.status !== "PROCESSING") {
    // Voided (UNPAYABLE) while awaiting review — approving would trap funds.
    throw createCustomError(4312, "Share is no longer in flight", 409);
  }

  await prisma.$transaction(async (tx) => {
    // Atomic claim — both guards re-checked in the write so a concurrent
    // approve/reject/void loses cleanly.
    const claimed = await tx.share.updateMany({
      where: { id: share.id, ...PENDING_ADMIN_APPROVAL_WHERE },
      data: {
        approvalStatus: "APPROVED",
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
      },
    });
    if (claimed.count === 0) {
      throw createCustomError(4310, "Share is not pending approval", 409);
    }

    // The deferred lock (fundingModeAtCreation is immutable, so the pre-fetch
    // values are safe inputs). PAYG shares stay lock-less.
    if (
      share.fundingModeAtCreation === "SUBSIDIZED" ||
      share.fundingModeAtCreation === "CREDITS"
    ) {
      await lockBudgetForShare(tx, {
        advertiserId: share.advertiserId ?? undefined,
        isSubsidized: share.fundingModeAtCreation === "SUBSIDIZED",
        shareId: share.id,
        estimatedPriceCents: share.estimatedPriceCents,
        currency: "usd",
        meta: { approvedByAdminId: adminId, reason: "ADMIN_APPROVE_SHARE" },
        capAtAvailableBudget: share.fundingModeAtCreation === "CREDITS",
      });
    }
  });

  // The share just became visible to the advertiser — tell them. Best-effort
  // (queueNotificationJobs never throws). Subsidized shares have no advertiser.
  if (share.advertiserId) {
    await queueNotificationJobs({
      eventSlug: "a.shares.created",
      advertiserIds: [share.advertiserId],
      payload: { shareUid: uid, localName: share.local?.name ?? null },
      dedupeKey: `share:${share.id}:created`,
    });
  }

  res.status(200).json({ message: "Share approved" });
});
