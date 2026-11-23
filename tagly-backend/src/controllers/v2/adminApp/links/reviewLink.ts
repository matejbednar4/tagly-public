import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import type {
  AdminReviewLinkBody,
  AdminReviewLinkParams,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/links/:id/review` — approve or reject a PENDING link.
 *
 * The decision is an atomic once-only CAS (PENDING → verdict + audit fields);
 * a lost race or an already-reviewed link is a 409. No side effects beyond the
 * status flip are needed:
 *   - APPROVED — the customer hydrators gate on `status = APPROVED`, so the
 *     URL goes live on every business referencing it immediately.
 *   - REJECTED — the shared Link row is the global kill-switch: the URL
 *     disappears from every referencing business's customer view, and any
 *     future business entering the same URL inherits the rejection (upsertLink
 *     reuses the row). The business `*LinkId` FKs stay connected on purpose —
 *     the owner still sees the link with its REJECTED status.
 */
export const reviewLink: RequestHandler = asyncHandler(async (req, res) => {
  const adminId = req.user.id;
  const { id } = req.validatedParams as AdminReviewLinkParams;
  const { status } = req.validatedBody as AdminReviewLinkBody;

  const claimed = await prisma.link.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
    },
  });

  if (claimed.count === 0) {
    const exists = await prisma.link.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw createCustomError(4960, "Link not found", 404);
    }
    throw createCustomError(4961, "Link has already been reviewed", 409);
  }

  res.status(200).json({
    message: status === "APPROVED" ? "Link approved" : "Link rejected",
  });
});
