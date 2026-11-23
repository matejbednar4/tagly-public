import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import { ADMIN_REVIEW } from "../../../../constants/platform/ADMIN_REVIEW.js";
import { SHARE_HAS_PENDING_REPORT_WHERE } from "../../../../utils/shares/shareAccess.js";
import adminHydrateShare from "../../../../utils/hydrators/admin/adminHydrateShare.js";

/**
 * `GET /v2/admin/shares/pending-report` — shares whose report is PENDING,
 * oldest report first (FIFO) with the full outstanding total. While a report
 * is PENDING the payment worker holds the payout, so this queue is what
 * unblocks money — verdicts land via `PUT /v2/admin/shares/:uid/report-review`.
 */
export const getSharesPendingReport: RequestHandler = asyncHandler(
  async (_req, res) => {
    const where = SHARE_HAS_PENDING_REPORT_WHERE;

    const [idRows, total] = await Promise.all([
      prisma.share.findMany({
        where,
        orderBy: { report: { createdAt: "asc" } },
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
      message: "Pending-report shares fetched successfully",
      shares,
      total,
    });
  }
);
