import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import {
  isAdminApprovedShare,
  isUnassessedShare,
} from "../../../../utils/shares/shareAccess.js";
import { claimShareAssessment } from "../../../../utils/shares/claimShareAssessment.js";
import { bumpCustomerRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import type {
  AdminAssessShareBody,
  AdminAssessShareParams,
} from "@tagly/models/v2/adminApp";

/**
 * `POST /v2/admin/shares/:uid/assess` — the admin twin of the advertiser's
 * `submitShareAssessment`, restricted to SUBSIDIZED shares (they have no
 * advertiser, so the admin rates/reports in that role).
 *
 * Guards: share exists, APPROVED (a PENDING/REJECTED share isn't in the rated
 * world), SUBSIDIZED by `fundingModeAtCreation` (the canonical signal), and
 * never assessed (`ratedAt` null — friendly pre-check + the shared atomic
 * claim). Deliberately no payout-`status` guard: rating measures post quality,
 * which is worth recording even on a PAID share (feeds future rewards).
 *
 * Outcomes ride the shared `claimShareAssessment` (identical to the
 * advertiser path): RATING stores half-stars + moves the customer's
 * multiplier; REPORT files a PENDING ShareReport that lands in the
 * report-review queue. After commit: reward-estimate cache bump on a
 * multiplier change, and the same `c.shares.rated` notification the
 * advertiser path sends.
 */
export const assessShare: RequestHandler = asyncHandler(async (req, res) => {
  const { uid } = req.validatedParams as AdminAssessShareParams;
  const body = req.validatedBody as AdminAssessShareBody;

  const now = new Date();

  const { customerId, multiplierChanged, localName, igPostType } =
    await prisma.$transaction(async (tx) => {
      const share = await tx.share.findUnique({
        where: { uid },
        select: {
          id: true,
          approvalStatus: true,
          fundingModeAtCreation: true,
          ratedAt: true,
          customer: { select: { id: true } },
          igPostType: true,
          local: { select: { name: true } },
        },
      });

      if (!share) {
        throw createCustomError(4042, "Share not found", 404);
      }
      if (!isAdminApprovedShare(share)) {
        throw createCustomError(4048, "Share is not approved", 409);
      }
      if (share.fundingModeAtCreation !== "SUBSIDIZED") {
        throw createCustomError(
          4047,
          "Only subsidized shares can be assessed by admins",
          409
        );
      }
      if (!isUnassessedShare(share)) {
        throw createCustomError(
          4093,
          "This share has already been assessed",
          409
        );
      }
      // Mirrors ADMIN_ASSESSABLE_SHARE_WHERE's `customerId: { not: null }`: an
      // assessment moves the customer's multiplier (rating) or files a report
      // against them, so a customerless share is not assessable — and never
      // appears in the unrated queue. Subsidized shares always have a customer,
      // so this is a defensive invariant guard that keeps the mutation and the
      // queue from disagreeing on what is assessable.
      if (share.customer?.id == null) {
        throw createCustomError(4050, "Share has no customer to assess", 409);
      }

      const { multiplierChanged } = await claimShareAssessment(tx, {
        shareId: share.id,
        customerId: share.customer.id,
        action:
          body.kind === "RATING"
            ? { kind: "RATING", rating: body.rating }
            : {
                kind: "REPORT",
                reportType: body.reportType,
                reportMessage: body.reportMessage ?? null,
              },
        now,
      });

      return {
        customerId: share.customer?.id ?? null,
        multiplierChanged,
        localName: share.local?.name ?? null,
        igPostType: share.igPostType,
      };
    });

  // The multiplier feeds reward estimates — invalidate the customer's cache.
  // Best-effort (fails open to the TTL).
  if (multiplierChanged && customerId != null) {
    await bumpCustomerRewardEstGen(customerId).catch(() => {});
  }

  // Same customer notification as the advertiser assessment path (best-effort
  // by the queue's contract).
  if (customerId != null) {
    await queueNotificationJobs({
      eventSlug: "c.shares.rated",
      customerIds: [customerId],
      payload: {
        shareUid: uid,
        localName,
        igPostType: igPostType ? igPostType.toLowerCase() : null,
      },
      dedupeKey: `share:${uid}:rated`,
    });
  }

  res.status(200).json({
    message:
      body.kind === "RATING"
        ? "Share rated successfully"
        : "Share reported successfully",
  });
});
