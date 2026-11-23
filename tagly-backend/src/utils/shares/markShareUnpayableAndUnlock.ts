import type { Prisma } from "../../generated/prisma/client.js";
import type { ShareVoidReason } from "@tagly/models/shared";
import { queueNotificationJobs } from "../queue/queueNotificationJobs.js";
import { releaseShareLockIfAny } from "./releaseShareLockIfAny.js";
import { PROCESSING_SHARE_WHERE } from "./shareAccess.js";

/**
 * Atomically voids an in-flight share and releases any budget it locked. This
 * is the single implementation shared by every path that has to abandon a share
 * whose data source disappeared: the IG insights/snapshot workers' max-attempts
 * backstop, the Meta data-deletion webhook (`deleteCustomerInstagramData`), and
 * the customer disconnect endpoint. The void
 * mechanics are settlement-tied (permanent ledger), invariant across the client
 * cutover — the trigger differs, the money movement must not.
 *
 * Behavior:
 * 1. **PROCESSING-guarded flip.** `updateMany({ where: { id, status:
 *    "PROCESSING" } })` → UNPAYABLE. If nothing was flipped (already PAID or
 *    UNPAYABLE) it returns `{ voided: false }` and unlocks nothing —
 *    we NEVER release budget for a share we did not actually void (a PAID share
 *    already moved its money; an UNPAYABLE one already released).
 * 2. **Correct-pool unlock.** On a real flip, read the original `SHARE_LOCK`
 *    event and release whichever pool it debited — advertiser
 *    (`unlockLockedBudgetForShare`) and/or platform
 *    (`unlockPlatformBudgetForShare`, subsidized). Both wrappers no-op safely
 *    when their pool wasn't locked (PENDING-approval never locked; PAYG is
 *    lock-less; an already-released share), so calling the relevant one is safe.
 *    `share.advertiserId` is NOT a reliable pool signal — a subsidized share can
 *    carry an advertiserId after `adminSetLocalAdvertiser` (see tagly-backend/CLAUDE.md
 *    §Subsidized Share Invariant) — so we branch on the lock event's own
 *    `advertiserId` + delta columns, never the share's.
 * 3. **Customer notification (transactional outbox).** On a real flip (and
 *    unless `notify: false`), queue `c.shares.unpayable` **with the caller's
 *    `tx`** so the queue row commits atomically with the void — a rollback
 *    erases both. Deduped to at most one notification per customer per day
 *    (a bulk void, e.g. an IG disconnect, collapses to a single push/email).
 *    Callers that destroy the recipient in the same transaction (account
 *    deletion) must pass `notify: false` — a queue row for a deleted customer
 *    is undeliverable junk.
 *
 * Must be called inside a `$transaction` (the flip + unlock have to commit
 * together). Idempotent: re-running against an already-voided share flips
 * nothing and unlocks nothing.
 */
export async function markShareUnpayableAndUnlock(
  tx: Prisma.TransactionClient,
  input: {
    shareId: number;
    /** USER-FACING classification (typed slug) — stamped to `Share.voidReason`
     *  and rendered as localized copy on the customer + advertiser share
     *  details. Pick the slug the affected humans should read, not the
     *  mechanism (a failed insights job is INSIGHTS_UNAVAILABLE). */
    reason: ShareVoidReason;
    /** Technical detail for admins (raw error text, sweep context, …) —
     *  goes to `lastProcessingError`. Falls back to the slug when omitted. */
    detail?: string;
    notify?: boolean;
  }
): Promise<{ voided: boolean }> {
  const { shareId, reason, detail, notify = true } = input;

  // Guard on PROCESSING so a terminal share (PAID/UNPAYABLE) is never
  // clobbered.
  const { count } = await tx.share.updateMany({
    where: { id: shareId, ...PROCESSING_SHARE_WHERE },
    data: {
      status: "UNPAYABLE",
      // User-facing slug (clients localize it) + the admin-facing technical
      // detail so admins can see why without grepping logs.
      voidReason: reason,
      lastProcessingError: detail ?? reason,
      lastProcessingErrorAt: new Date(),
    },
  });

  // Only unlock if we actually flipped it — never release budget for a share we
  // didn't void.
  if (count === 0) return { voided: false };

  // Refund whichever pool actually locked budget for this share (the shared
  // correct-pool release — reads the original SHARE_LOCK event, never the
  // share's advertiserId).
  await releaseShareLockIfAny(tx, { shareId, meta: { reason: detail ?? reason } });

  if (notify) {
    const share = await tx.share.findUnique({
      where: { id: shareId },
      select: {
        uid: true,
        customerId: true,
        local: { select: { name: true } },
      },
    });
    if (share && share.customerId !== null) {
      // Daily per-customer dedupe: the queue's unique constraint silently
      // absorbs every void after the first that day.
      const day = new Date().toISOString().slice(0, 10);
      await queueNotificationJobs({
        customerIds: [share.customerId],
        eventSlug: "c.shares.unpayable",
        payload: { shareUid: share.uid, localName: share.local?.name },
        dedupeKey: `share-unpayable:${share.customerId}:${day}`,
        tx,
      });
    }
  }

  return { voided: true };
}
