import prisma from "../../../prisma/prisma.js";
import { promoEventsRaw } from "../../../constants/catalogs/notifications/promoCatalog.js";
import { queuePromoNotificationJobsOrReturn } from "../../../utils/queue/queuePromoNotificationJobsOrReturn.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import type { PromoEventSlug } from "../../../constants/catalogs/notifications/promoCatalog.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Queues re-engagement nudges for registered Customers who have at least one
 * Share but haven't shared recently.
 *
 * Each step targets a non-overlapping window relative to most recent
 * Share.createdAt, so a customer is in exactly one window at a time and
 * receives at most one step per run.
 *
 * Re-arming (episode semantics): unlike the one-shot pending/first-share
 * sequences, inactivity is recurring — a customer who got the d7 reminder,
 * came back and shared, then went quiet again should get d7 again for the NEW
 * inactivity episode. The `PromoNotificationLog` keeps one row per
 * (customer, slug, channel) whose `sentAt` refreshes on each send, so "already
 * notified" here means "a log row NEWER than the customer's latest share"
 * (sent during the current episode). A log row older than the latest share is
 * a previous episode and doesn't block.
 *
 * The Prisma `none: { sentAt: { gt: minAgo } }` pre-filter is a safe superset
 * cut: eligibility requires log.sentAt < latestShare ≤ minAgo, so any log
 * newer than minAgo is definitely blocking. The exact log-vs-latest-share
 * comparison (which Prisma can't correlate across relations) happens in JS on
 * the batch.
 */
export const scheduleInactivityReminders: MaintenanceTask = {
  name: "schedule inactivity reminders",
  run: async ({ now, log }) => {
    for (const [slug, event] of Object.entries(promoEventsRaw)) {
      if (event.cadence.kind !== "inactivityReminder") continue;

      const { minDays, maxDays } = event.cadence;
      const minAgo = new Date(now.getTime() - minDays * 24 * 60 * 60 * 1000);
      const maxAgo = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);

      let totalEligible = 0;
      let totalQueued = 0;
      let lastId = 0;

      while (true) {
        const batch = await prisma.customer.findMany({
          where: {
            id: { gt: lastId },
            shares: {
              some: { createdAt: { lte: minAgo, gt: maxAgo } },
              none: { createdAt: { gt: minAgo } },
            },
            // Superset cut only — the episode-exact check is below.
            promoNotificationLogs: {
              none: { eventSlug: slug, sentAt: { gt: minAgo } },
            },
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take: T.fetchBatchSize,
        });

        if (batch.length === 0) break;
        const ids = batch.map((c) => c.id);

        // Episode check: eligible iff no log row for this slug is newer than
        // the customer's latest share (i.e. nothing sent during THIS episode).
        const [latestShares, logs] = await Promise.all([
          prisma.share.groupBy({
            by: ["customerId"],
            where: { customerId: { in: ids } },
            _max: { createdAt: true },
          }),
          prisma.promoNotificationLog.findMany({
            where: { customerId: { in: ids }, eventSlug: slug },
            select: { customerId: true, sentAt: true },
          }),
        ]);
        const latestShareById = new Map(
          latestShares.map((s) => [s.customerId, s._max.createdAt]),
        );
        const newestLogById = new Map<number, Date>();
        for (const l of logs) {
          if (l.customerId === null) continue;
          const prev = newestLogById.get(l.customerId);
          if (!prev || l.sentAt > prev) newestLogById.set(l.customerId, l.sentAt);
        }

        const eligibleIds = ids.filter((id) => {
          const latestShare = latestShareById.get(id);
          if (!latestShare) return false; // raced away; window filter caught it
          const newestLog = newestLogById.get(id);
          return !newestLog || newestLog < latestShare;
        });

        totalEligible += eligibleIds.length;
        if (eligibleIds.length > 0) {
          totalQueued += await queuePromoNotificationJobsOrReturn({
            eventSlug: slug as PromoEventSlug,
            target: "CUSTOMER",
            recipientIds: eligibleIds,
          });
        }

        lastId = batch[batch.length - 1].id;
        if (batch.length < T.fetchBatchSize) break;
      }

      if (totalEligible > 0) {
        log.info(
          `(NUDGE_INACTIVITY) ${slug}: queued ${totalQueued} jobs for ${totalEligible} eligible customers`,
        );
      }
    }
  },
};
