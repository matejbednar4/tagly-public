import type { RequestHandler } from "express";
import { asyncHandler } from "../../../../utils/core/http/asyncHandler.js";
import { createCustomError } from "../../../../utils/core/errors/createCustomError.js";
import prisma from "../../../../prisma/prisma.js";
import type {
  ShareUidParams,
  ShareAssessmentBody,
} from "@tagly/models/v2/advertiserApp";
import { queueNotificationJobs } from "../../../../utils/queue/queueNotificationJobs.js";
import { claimShareAssessment } from "../../../../utils/shares/claimShareAssessment.js";
import { bumpCustomerRewardEstGen } from "../../../../utils/pricing/rewardEstCache.js";
import { isAdminApprovedShare } from "../../../../utils/shares/shareAccess.js";
import hydrateAdvertiserSharePreviews from "../../../../utils/hydrators/shares/hydrateAdvertiserSharePreviews.js";

/**
 * `POST /v2/advertisers/shares/:uid/assessment` — the advertiser assesses one of
 * their shares. Rating and reporting are the two mutually-exclusive outcomes of
 * the same action, so this single controller owns the shared prelude and
 * branches on `body.kind`.
 *
 * A share is assessed **exactly once** — there is no re-rate / re-report / change
 * window. The first rating or report is final (`ratedAt` is stamped atomically and
 * only from null), so this controller never reverts a prior delta or clears a
 * prior report; a second attempt is a 409.
 *
 * Shared prelude (both kinds):
 *   1. IDOR + visibility guard — the share must be the advertiser's and APPROVED
 *      (PENDING/REJECTED are invisible → treated as not found).
 *   2. Once-only guard — an already-assessed share (`ratedAt` set) is rejected;
 *      the write itself claims `ratedAt` from null (`updateMany` count) so two
 *      concurrent attempts can't both land.
 *
 * The rating drives the customer's rolling QUALITY multiplier (a signal of how
 * good the sharer's posts tend to be — NOT the post's performance/price; see
 * `docs/SHARE_LIFECYCLE.md` §Share rating):
 *   - RATING → apply the star delta to the multiplier, store the half-stars +
 *     `ratedAt`.
 *   - REPORT → create a PENDING ShareReport, store `ratedAt` (no multiplier
 *     change — a reported share was never rated).
 *
 * Because the multiplier feeds reward estimates, a rating bumps the customer's
 * reward-estimate cache generation (`bumpCustomerRewardEstGen`) after commit —
 * this endpoint is the first writer of that rating-driven bump. The response
 * echoes the freshly-hydrated share so the client can swap it into any list.
 */
export const submitShareAssessment: RequestHandler = asyncHandler(
  async (req, res) => {
    const advertiserId = req.user.id;
    const { uid } = req.validatedParams as ShareUidParams;
    const body = req.validatedBody as ShareAssessmentBody;

    const now = new Date();

    const { shareId, customerId, multiplierChanged, localName, igPostType } =
      await prisma.$transaction(async (tx) => {
        const share = await tx.share.findUnique({
          where: { uid },
          select: {
            id: true,
            advertiserId: true,
            approvalStatus: true,
            ratedAt: true, // null ⟺ never assessed (see schema invariant)
            customer: { select: { id: true } },
            igPostType: true,
            local: { select: { name: true } },
          },
        });

        // Advertisers can only act on their own APPROVED shares — anything else
        // is treated as not found so its existence never leaks.
        if (
          !share ||
          share.advertiserId !== advertiserId ||
          !isAdminApprovedShare(share)
        ) {
          throw createCustomError(
            4042,
            "Share not found or does not belong to your advertiser",
            404
          );
        }

        // Once-only: a share is rated OR reported exactly once, never changed.
        if (share.ratedAt) {
          throw createCustomError(
            4093,
            "This share has already been assessed",
            409
          );
        }

        // Parity with ADVERTISER_ASSESSABLE_SHARE_WHERE / the admin assess path:
        // a customerless share (customer deleted → customerId SetNull) is not
        // assessable — there's no one to rate and it's UNPAYABLE with tombstoned
        // media. The unrated queue already excludes these, so this only guards a
        // direct call; `shouldAssessShare` is false for them.
        if (share.customer?.id == null) {
          throw createCustomError(4050, "Share has no customer to assess", 409);
        }

        // Shared once-only claim + write (CAS on `ratedAt` from null; rating
        // applies the star delta, report files a PENDING ShareReport). Same
        // util the admin assessment uses, so the guarantees can't drift.
        const { multiplierChanged } = await claimShareAssessment(tx, {
          shareId: share.id,
          customerId: share.customer?.id ?? null,
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
          shareId: share.id,
          customerId: share.customer?.id ?? null,
          multiplierChanged,
          localName: share.local?.name ?? null,
          igPostType: share.igPostType,
        };
      });

    // The rating changed the customer's multiplier, which feeds reward estimates
    // — invalidate their cached estimates. Best-effort (fails open to the TTL).
    if (multiplierChanged && customerId != null) {
      await bumpCustomerRewardEstGen(customerId).catch(() => {});
    }

    // Notify the customer their share was assessed (best-effort).
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
      }).catch(() => {});
    }

    const [share] = await hydrateAdvertiserSharePreviews({
      shareIds: [shareId],
    });

    res.status(200).json({
      message:
        body.kind === "RATING"
          ? "Share rated successfully"
          : "Share reported successfully",
      share,
    });
  }
);
