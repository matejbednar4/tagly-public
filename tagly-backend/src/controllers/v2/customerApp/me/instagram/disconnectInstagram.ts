import type { RequestHandler } from "express";
import prisma from "../../../../../prisma/prisma.js";
import { asyncHandler } from "../../../../../utils/core/http/asyncHandler.js";
import { bumpCustomerRewardEstGen } from "../../../../../utils/pricing/rewardEstCache.js";
import { markShareUnpayableAndUnlock } from "../../../../../utils/shares/markShareUnpayableAndUnlock.js";
import { PROCESSING_SHARE_WHERE } from "../../../../../utils/shares/shareAccess.js";
import type { DisconnectInstagramResponse } from "@tagly/models/v2/customerApp";

/**
 * `DELETE /v2/customers/me/instagram` — disconnect the logged-in customer's
 * Instagram so they can connect a *different* account ("I linked the wrong one").
 *
 * Disconnect is a **HARD delete** of the `CustomerInstagramAccount` row, never a
 * soft flag: the row's `onDelete: Cascade` (token, audience snapshots + their
 * children, snapshot queues, and the share-tied snapshots) IS the snapshot-safety
 * mechanism — after the delete it is structurally impossible for a later connect
 * of a different IG to read this account's audience data (every price/payment
 * read joins through `instagram: { customerId }`). A fresh link therefore has no
 * snapshot → `hasSnapshot: false` → shares can't be created/priced until the
 * snapshot worker writes a new one.
 *
 * In-flight settlement is resolved BEFORE the delete, in one transaction:
 *   1. Void every PROCESSING share (`markShareUnpayableAndUnlock`) → UNPAYABLE +
 *      release its lock (advertiser or platform, off the SHARE_LOCK event).
 *      Voided shares keep `igPostId`/`igPostType`/`postedToIgAt` — a story is
 *      monetizable ONCE, EVER (E074, Matej 2026-08-02): the old null-out here,
 *      justified as "reconnect and re-share the same story", was wrong, and
 *      dedup now lives in the append-only `monetized_instagram_posts` registry
 *      anyway, so freeing the column would not free the story. Keeping
 *      `postedToIgAt` also keeps the voided shares inside the frequency
 *      dampener's windows. The customer is warned in the confirm sheet that
 *      unpaid shares will not be paid.
 *   2. Delete the voided shares' `InstagramInsightsQueue` rows — they're keyed by
 *      shareId and do NOT cascade with the account row, so a pending insights job
 *      would otherwise run against a deleted account.
 *   3. Hard-delete the account row (cascade does the rest).
 *
 * Idempotent: no linked account → 200 no-op (retry-safe). PAID history, media,
 * and non-PROCESSING shares are left untouched. Banned customers may disconnect
 * (it isn't value-bearing; the uid stays block-listed regardless).
 */
export const disconnectInstagram: RequestHandler = asyncHandler(
  async (req, res) => {
    const customerId = req.user.id;

    await prisma.$transaction(async (tx) => {
      const account = await tx.customerInstagramAccount.findFirst({
        where: { customerId },
        select: { id: true },
      });

      // Nothing linked → idempotent no-op.
      if (!account) return;

      // Void every in-flight share + release its lock. The helper is
      // PROCESSING-guarded, so this can only flip genuinely-processing shares.
      const processingShares = await tx.share.findMany({
        where: { customerId, ...PROCESSING_SHARE_WHERE },
        select: { id: true },
      });

      const voidedShareIds: number[] = [];
      for (const share of processingShares) {
        const { voided } = await markShareUnpayableAndUnlock(tx, {
          shareId: share.id,
          reason: "IG_DISCONNECTED",
          detail: "customer disconnected Instagram",
        });
        if (voided) voidedShareIds.push(share.id);
      }

      if (voidedShareIds.length > 0) {
        // InstagramInsightsQueue is keyed by shareId and does NOT cascade with
        // the account row — remove the voided shares' pending jobs explicitly.
        // (The voided shares' igPostId/postedToIgAt deliberately stay — see
        // docblock step 1: once monetized-or-attempted, a story never frees.)
        await tx.instagramInsightsQueue.deleteMany({
          where: { shareId: { in: voidedShareIds } },
        });
      }

      // Hard delete — cascade removes token + snapshots (+ audience children) +
      // snapshot queues. This cascade is the snapshot-safety guarantee.
      await tx.customerInstagramAccount.delete({ where: { id: account.id } });
    });

    // Snapshot/token are gone → the reward estimate changes. Invalidate cache.
    await bumpCustomerRewardEstGen(customerId);

    res.status(200).json({
      message: "Instagram disconnected",
    } satisfies DisconnectInstagramResponse);
  }
);
