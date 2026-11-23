import { Prisma } from "../../generated/prisma/client.js";
import type { ShareVoidReason } from "@tagly/models/shared";
import { markShareUnpayableAndUnlock } from "../shares/markShareUnpayableAndUnlock.js";
import { PAID_SHARE_WHERE } from "../shares/shareAccess.js";

/**
 * Deletes all Instagram-related data for a customer.
 *
 * This function handles the complete cleanup of a customer's Instagram integration:
 * 1. Marks unpaid shares as UNPAYABLE and unlocks any locked budget (refunds both advertiser- and platform-locked pools)
 * 2. Deletes insights records (story, post, reel insights)
 * 3. Deletes snapshot and queue records
 * 4. Nullifies IG-specific fields on shares (preserving payment history —
 *    PAID rows keep `postedToIgAt` for the frequency dampener; see below)
 * 5. Deletes thumbnails and tombstones main media keys
 * 6. Deletes the CustomerInstagramAccount record (if one is still linked)
 *
 * Keyed off the customer's SHARES, not the IG account row: a customer who
 * disconnected (`DELETE /v2/customers/me/instagram`) has their account row +
 * snapshots already gone, but keeps their share rows + media. This still needs
 * to purge that media on account deletion / GDPR erasure, so we do NOT early-out
 * when no account row exists — we clean up every share the customer has and then
 * delete the account row only if it's still there (`deleteMany` no-ops otherwise).
 *
 * Voided shares queue the `c.shares.unpayable` customer notification (daily
 * deduped, outbox — see `markShareUnpayableAndUnlock`) unless
 * `opts.notifyCustomer: false`. Account-deletion callers MUST pass `false` —
 * they destroy the recipient in the same transaction, so a queue row would be
 * undeliverable junk.
 *
 * @returns Array of S3 keys that should be deleted (caller handles S3 cleanup)
 */
export async function deleteCustomerInstagramData(
  customerId: number,
  tx: Prisma.TransactionClient,
  opts?: {
    notifyCustomer?: boolean;
    /** User-facing void classification for the in-flight shares this call
     *  voids. Defaults to IG_DATA_DELETED (the Meta webhook / in-app data-
     *  deletion callers); account-deletion callers pass ACCOUNT_DELETED. */
    voidReason?: Extract<ShareVoidReason, "IG_DATA_DELETED" | "ACCOUNT_DELETED">;
  }
): Promise<string[]> {
  let s3KeysToDelete: string[] = [];

  const shares = await tx.share.findMany({
    where: { customerId },
    select: {
      id: true,
      media: { select: { id: true, key: true } },
      thumbnail: { select: { id: true, key: true } },
    },
  });

  const shareIds = shares.map((s) => s.id);

  if (shareIds.length > 0) {
    // Void every in-flight (PROCESSING) share + release its lock. The shared
    // helper is PROCESSING-guarded, so PAID/UNPAYABLE/REJECTED shares are
    // skipped, and it refunds the correct pool (advertiser or platform) off the
    // original SHARE_LOCK event.
    for (const shareId of shareIds) {
      await markShareUnpayableAndUnlock(tx, {
        shareId,
        reason: opts?.voidReason ?? "IG_DATA_DELETED",
        detail: "customer deleted their Instagram data",
        notify: opts?.notifyCustomer ?? true,
      });
    }
  }

  const shareMedia = shares.map((s) => s.media);
  const shareThumbnails = shares
    .map((s) => s.thumbnail)
    .filter((t) => t !== null);

  if (shareIds.length > 0) {
    await tx.shareInsights.deleteMany({
      where: { shareId: { in: shareIds } },
    });

    await tx.instagramSnapshot.deleteMany({
      where: { shareId: { in: shareIds } },
    });

    await tx.instagramInsightsQueue.deleteMany({
      where: { shareId: { in: shareIds } },
    });

    // Null IG-specific fields on shares; keep shares themselves + pricing/
    // ledger history. Once-only monetization survives this de-link: the
    // append-only `monetized_instagram_posts` registry (written at share
    // creation, no customer link) carries the dedup, so `igPostId` can be
    // nulled on EVERY share here — including PAID (E074).
    //
    // PAID shares RETAIN `postedToIgAt`: the frequency dampener keys on it,
    // and nulling it let a self-service data-deletion round-trip (Meta
    // webhook / disconnect endpoint) empty both rolling windows so the next share
    // priced as a first-ever post — repeatable reward inflation. A paid
    // transaction's post timestamp is platform bookkeeping retained for
    // fraud prevention, not IG content (Matej, 2026-08-02). Non-PAID rows
    // null it too (they are all dead: this call just voided the PROCESSING
    // ones).
    await tx.share.updateMany({
      where: { id: { in: shareIds }, NOT: PAID_SHARE_WHERE },
      data: {
        thumbnailId: null,
        igPostId: null,
        postedToIgAt: null,
        igPostType: null,
      },
    });
    await tx.share.updateMany({
      where: { id: { in: shareIds }, ...PAID_SHARE_WHERE },
      data: {
        thumbnailId: null,
        igPostId: null,
        igPostType: null,
      },
    });

    // delete thumbnails
    if (shareThumbnails.length > 0) {
      await tx.media.deleteMany({
        where: { id: { in: shareThumbnails.map((t) => t.id) } },
      });
    }

    // tombstone main media keys so future loads do not show IG content
    for (const m of shareMedia) {
      await tx.media.update({
        where: { id: m.id },
        data: { key: `deleted/${m.key}` },
      });
    }

    // collect original keys for S3 deletion
    s3KeysToDelete.push(...shareMedia.map((m) => m.key));
    s3KeysToDelete.push(...shareThumbnails.map((t) => t!.key));
  }

  // delete the IG account row itself (no-op if the customer already disconnected
  // — the share/media cleanup above still ran off customer.shares)
  await tx.customerInstagramAccount.deleteMany({
    where: { customerId },
  });

  return s3KeysToDelete;
}
