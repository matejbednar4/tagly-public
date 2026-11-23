import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import { REPORT_PENALTIES } from "../../../../constants/content/REPORT_PENALTIES.js";
import {
  adjustCustomerMultiplierBps,
  multiplierDeltaForStars,
} from "../../../../utils/customers/adjustCustomerMultiplierBps.js";
import { releaseShareLockIfAny } from "../../../../utils/shares/releaseShareLockIfAny.js";
import { PROCESSING_SHARE_WHERE } from "../../../../utils/shares/shareAccess.js";
import { bumpCustomerRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import type {
  AdminReviewShareReportBody,
  AdminReviewShareReportParams,
} from "@tagly/models/v2/adminApp";

/**
 * `PUT /v2/admin/shares/:uid/report-review` — resolve a PENDING share report.
 * While the report was PENDING the payment worker held the payout, so this
 * verdict is what decides the money (see docs/SHARE_LIFECYCLE.md §Report Flow).
 *
 * Both branches start with an atomic CAS claim on the report row
 * (PENDING → verdict), so two concurrent reviews can't both apply money/
 * penalty effects.
 *
 * VALID (the advertiser was right):
 *   - The share row is NOT touched — `status` stays PROCESSING and no rating
 *     is written ("reported" is not a rating in v2). The VALID report row IS
 *     the signal: the payment gate excludes it forever (never paid) and the
 *     customer-facing status derives REJECTED.
 *   - Not yet paid → the original lock is released to whichever pool it
 *     debited (shared `releaseShareLockIfAny` — correct for CREDITS,
 *     SUBSIDIZED, lock-less PAYG, and a deleted advertiser — never branch on
 *     `fundingModeAtCreation` + `advertiserId!` here, that breaks on both PAYG
 *     and deleted-advertiser shares). Already PAID → money stays (no clawback).
 *   - The customer's multiplier takes the report's base penalty escalated by
 *     their repeat-offense count (max of same-type / total VALID reports).
 *
 * DISMISSED (the content was fine — a quality rating is REQUIRED):
 *   - Report → DISMISSED; the share gets the admin's half-star rating in the
 *     advertiser's stead. `ratedAt` is preserved (`ratedAt ?? now` — the
 *     report filing already stamped it; see the schema invariant).
 *   - The rating's star delta moves the multiplier; the payment worker then
 *     pays the share normally.
 *
 * After commit, any multiplier change bumps the customer's reward-estimate
 * cache generation.
 */
export const reviewShareReport: RequestHandler = asyncHandler(
  async (req, res) => {
    const adminId = req.user.id;
    const { uid } = req.validatedParams as AdminReviewShareReportParams;
    const body = req.validatedBody as AdminReviewShareReportBody;

    const share = await prisma.share.findUnique({
      where: { uid },
      select: {
        id: true,
        status: true,
        customerId: true,
        advertiserId: true,
        fundingModeAtCreation: true,
        ratedAt: true,
        report: { select: { id: true, status: true, reportType: true } },
      },
    });
    if (!share) {
      throw createCustomError(4042, "Share not found", 404);
    }
    if (!share.report) {
      throw createCustomError(4912, "Share has no report", 400);
    }
    if (share.report.status !== "PENDING") {
      throw createCustomError(4913, "Report has already been reviewed", 409);
    }
    const report = share.report;

    let multiplierChanged = false;
    let wasPaid = false;

    await prisma.$transaction(async (tx) => {
      // Atomic verdict claim — the loser of a concurrent review gets 4913 and
      // applies no money/penalty effects.
      const claimed = await tx.shareReport.updateMany({
        where: { id: report.id, status: "PENDING" },
        data: {
          status: body.verdict,
          reviewedById: adminId,
          reviewedAt: new Date(),
          reviewMessage: body.reviewMessage ?? null,
        },
      });
      if (claimed.count === 0) {
        throw createCustomError(4913, "Report has already been reviewed", 409);
      }

      if (body.verdict === "VALID") {
        // Return the held budget unless the money already moved. The pre-tx
        // `share.status` read is stale by definition, so re-claim it here: the
        // CAS takes the share row lock (serializing against the settle claim
        // in `markSharePaidOrThrow` and the void CAS) and re-evaluates
        // `status = PROCESSING` on the committed tuple. Losing it (the share
        // went PAID/UNPAYABLE meanwhile) skips the release — a PAID share's
        // money already moved (no clawback policy) and a voided share already
        // released its lock. The settle side re-checks the report status under
        // the same row lock, so a settle can never commit after this verdict.
        const stillInFlight = await tx.share.updateMany({
          where: { id: share.id, ...PROCESSING_SHARE_WHERE },
          data: { updatedAt: new Date() },
        });
        if (stillInFlight.count > 0) {
          await releaseShareLockIfAny(tx, {
            shareId: share.id,
            meta: { reviewedByAdminId: adminId, reason: "REPORT_VALID" },
          });
        }

        if (share.customerId != null) {
          // Escalating penalty: base for this report type × the customer's
          // repeat-offense count (max of same-type / total VALID reports,
          // including this one).
          const previousValidReports = await tx.shareReport.findMany({
            where: {
              status: "VALID",
              share: { customerId: share.customerId },
              id: { not: report.id },
            },
            select: { reportType: true },
          });
          const sameTypeCount =
            previousValidReports.filter(
              (r) => r.reportType === report.reportType
            ).length + 1;
          const totalCount = previousValidReports.length + 1;
          const escalation = Math.max(sameTypeCount, totalCount);
          const basePenalty =
            REPORT_PENALTIES.BASE_PENALTIES_BPS[report.reportType] ?? -1000;

          await adjustCustomerMultiplierBps(
            tx,
            share.customerId,
            basePenalty * escalation
          );
          multiplierChanged = true;
        }
      } else {
        // DISMISSED — the admin's quality rating stands in for the missing
        // advertiser rating. Preserve `ratedAt` (stamped when the report was
        // filed) per the schema invariant.
        await tx.share.update({
          where: { id: share.id },
          data: {
            rating: body.rating,
            ratedAt: share.ratedAt ?? new Date(),
          },
        });

        const delta = multiplierDeltaForStars(body.rating);
        if (delta !== 0 && share.customerId != null) {
          await adjustCustomerMultiplierBps(tx, share.customerId, delta);
          multiplierChanged = true;
        }
      }

      // Captured for the reporter notification: on an already-PAID share the
      // verdict moves no money, and the push copy must not promise otherwise
      // (E047). Read at the END of the tx — the verdict never flips `status`,
      // and the row lock taken above means this also reflects a settle that
      // won the race before our claim.
      const fresh = await tx.share.findUnique({
        where: { id: share.id },
        select: { status: true },
      });
      wasPaid = fresh?.status === "PAID";
    });

    // The multiplier feeds reward estimates — invalidate the customer's cache.
    // Best-effort (fails open to the TTL).
    if (multiplierChanged && share.customerId != null) {
      await bumpCustomerRewardEstGen(share.customerId).catch(() => {});
    }

    // Tell the reporter the verdict (best-effort, after commit; deduped per
    // report, so the CAS-losing retry path can't double-notify). Only for
    // advertiser-reported shares — a SUBSIDIZED share's report was filed by an
    // admin, and `advertiserId` is not a reporter signal there.
    // The CUSTOMER is deliberately NOT notified of the verdict (decided
    // 2026-07-25): they see the derived share status in-app; a DISMISSED share
    // notifies via the payout anyway.
    if (
      share.advertiserId != null &&
      share.fundingModeAtCreation !== "SUBSIDIZED"
    ) {
      await queueNotificationJobs({
        advertiserIds: [share.advertiserId],
        eventSlug: "a.shares.report-updated",
        payload: { verdict: body.verdict, shareUid: uid, wasPaid },
        dedupeKey: `report-updated-a-${report.id}`,
      });
    }

    res.status(200).json({
      message:
        body.verdict === "VALID"
          ? "Report marked valid — share will not be paid"
          : "Report dismissed — share rated and payable",
    });
  }
);
