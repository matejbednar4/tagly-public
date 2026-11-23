import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import prisma from "../../../../prisma/prisma.js";
import {
  PENDING_ADMIN_APPROVAL_QUEUE_WHERE,
  ADMIN_ASSESSABLE_SHARE_WHERE,
  PENDING_REPORT_WHERE,
} from "../../../../utils/shares/shareAccess.js";
import type { AdminReviewCountsResponse } from "@tagly/models/v2/adminApp";

/**
 * `GET /v2/admin/review/counts` — the outstanding size of every moderation
 * queue, for the Review hub's buttons. Each count uses the EXACT same filter
 * as its list endpoint (pending-approval / pending-report / unrated / links
 * pending) so the badge always matches what the queue screen shows.
 */
export const getReviewCounts: RequestHandler = asyncHandler(
  async (_req, res) => {
    const [pendingApproval, pendingReports, unratedSubsidized, pendingLinks] =
      await Promise.all([
        prisma.share.count({ where: PENDING_ADMIN_APPROVAL_QUEUE_WHERE }),
        prisma.shareReport.count({ where: PENDING_REPORT_WHERE }),
        prisma.share.count({ where: ADMIN_ASSESSABLE_SHARE_WHERE }),
        prisma.link.count({ where: { status: "PENDING" } }),
      ]);

    res.status(200).json({
      message: "Review counts fetched successfully",
      counts: {
        pendingApproval,
        pendingReports,
        unratedSubsidized,
        pendingLinks,
      },
    } satisfies AdminReviewCountsResponse);
  }
);
