import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { ADMIN_REVIEW } from "../../../../constants/platform/ADMIN_REVIEW.js";
import { PENDING_ADMIN_APPROVAL_QUEUE_WHERE } from "../../../../utils/shares/shareAccess.js";
import adminHydrateShare from "../../../../utils/hydrators/admin/adminHydrateShare.js";

/**
 * `GET /v2/admin/shares/pending-approval` — the intake moderation queue,
 * oldest first (FIFO) with the full outstanding total.
 *
 * Filter matches the approve/reject CAS guards exactly:
 *   - `approvalStatus = PENDING` — awaiting the intake decision.
 *   - `status = PROCESSING` — a share voided to UNPAYABLE while pending (IG
 *     disconnect, insights/snapshot expiry) must drop out of the queue:
 *     approving it would place a budget lock the payment worker can never
 *     settle or release (trapped funds).
 *   - has a customer (a share whose customer was deleted is voided anyway).
 */
export const getSharesPendingApproval: RequestHandler = asyncHandler(
  async (_req, res) => {
    const where = PENDING_ADMIN_APPROVAL_QUEUE_WHERE;

    const [idRows, total] = await Promise.all([
      prisma.share.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: ADMIN_REVIEW.QUEUE_PAGE_SIZE,
        select: { id: true },
      }),
      prisma.share.count({ where }),
    ]);

    // The hydrator preserves input order, so the FIFO order carries through.
    const shares = await adminHydrateShare({
      shareIds: idRows.map((r) => r.id),
    });

    res.status(200).json({
      message: "Pending-approval shares fetched successfully",
      shares,
      total,
    });
  }
);
