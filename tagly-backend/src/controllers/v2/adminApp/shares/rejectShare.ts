import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import { SHARE_REJECTION_PENALTY_BPS } from "../../../../constants/content/REPORT_PENALTIES.js";
import { PENDING_ADMIN_APPROVAL_WHERE } from "../../../../utils/shares/shareAccess.js";
import { adjustCustomerMultiplierBps } from "../../../../utils/customers/adjustCustomerMultiplierBps.js";
import { bumpCustomerRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import type {
  AdminRejectShareBody,
  AdminRejectShareParams,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/shares/:uid/reject` — intake-reject a PENDING share.
 *
 * Flow (see tagly-backend/CLAUDE.md §Share Approval Gate + docs/SHARE_LIFECYCLE.md):
 *   1. Guards mirror approve: PENDING + still PROCESSING (pre-check + atomic
 *      claim). Rejecting a share already voided to UNPAYABLE would clobber a
 *      terminal state after its money logic ran and double-penalize the
 *      customer.
 *   2. Atomic CAS → `approvalStatus = REJECTED` + audit fields + the reason.
 *      The payout `status` deliberately stays PROCESSING — rejection is NOT a
 *      status in v2 (the enum has no REJECTED); the payment worker requires
 *      `approvalStatus = APPROVED`, so a rejected share is never paid. No lock
 *      to return — none was placed while PENDING.
 *   3. Penalize the customer's rolling multiplier (flat rejection penalty),
 *      inside the same tx.
 *   4. After commit: bump the customer's reward-estimate cache generation (the
 *      multiplier feeds estimates) and send the MANDATORY `c.shares.rejected`
 *      push+email with the reason (shown to the customer verbatim).
 *
 * Rejection is the only way to kill a bad share — there is no hard delete; the
 * row + media are kept for audit.
 */
export const rejectShare: RequestHandler = asyncHandler(async (req, res) => {
  const adminId = req.user.id;
  const { uid } = req.validatedParams as AdminRejectShareParams;
  const { reason } = req.validatedBody as AdminRejectShareBody;

  const share = await prisma.share.findUnique({
    where: { uid },
    select: { id: true, status: true, approvalStatus: true, customerId: true },
  });
  if (!share) {
    throw createCustomError(4042, "Share not found", 404);
  }
  if (share.approvalStatus !== "PENDING") {
    throw createCustomError(4311, "Share is not pending approval", 409);
  }
  if (share.status !== "PROCESSING") {
    throw createCustomError(4312, "Share is no longer in flight", 409);
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.share.updateMany({
      where: { id: share.id, ...PENDING_ADMIN_APPROVAL_WHERE },
      data: {
        approvalStatus: "REJECTED",
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
        rejectionReason: reason,
      },
    });
    if (claimed.count === 0) {
      throw createCustomError(4311, "Share is not pending approval", 409);
    }

    // A rejected share was deemed bad/fake before the business ever saw it —
    // meaningful flat penalty on the customer's rolling multiplier (clamped).
    if (share.customerId != null) {
      await adjustCustomerMultiplierBps(
        tx,
        share.customerId,
        SHARE_REJECTION_PENALTY_BPS
      );
    }
  });

  if (share.customerId != null) {
    // The multiplier feeds reward estimates — invalidate the customer's cache.
    // Best-effort (fails open to the TTL).
    await bumpCustomerRewardEstGen(share.customerId).catch(() => {});

    // Mandatory push+email with the reason (queue contract: never throws).
    await queueNotificationJobs({
      eventSlug: "c.shares.rejected",
      customerIds: [share.customerId],
      payload: { reason, shareUid: uid },
      dedupeKey: `share-rejected:${share.id}`,
    });
  }

  res.status(200).json({ message: "Share rejected" });
});
