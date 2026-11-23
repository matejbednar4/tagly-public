import prisma from "../../../prisma/prisma.js";
import { promoEventsRaw } from "../../../constants/catalogs/notifications/promoCatalog.js";
import { queuePromoNotificationJobsOrReturn } from "../../../utils/queue/queuePromoNotificationJobsOrReturn.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import type { PromoEventSlug } from "../../../constants/catalogs/notifications/promoCatalog.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Queues "make your first share" nudge notifications for registered Customers
 * who have never made a share.
 *
 * Each step targets a non-overlapping window of Customer.createdAt age,
 * so a customer is in exactly one window at a time and receives at most one step per run.
 * Stops as soon as the customer has any Share — Prisma's `shares: { none: {} }`
 * filter evaluates at query time.
 * Already-notified recipients are excluded via PromoNotificationLog, written by
 * the notification worker after each successful send.
 */
export const scheduleFirstShareNudges: MaintenanceTask = {
  name: "schedule first-share nudges",
  run: async ({ now, log }) => {
    for (const [slug, event] of Object.entries(promoEventsRaw)) {
      if (event.cadence.kind !== "firstShareNudge") continue;

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
            shares: { none: {} },
            createdAt: { lte: minAgo, gt: maxAgo },
            promoNotificationLogs: { none: { eventSlug: slug } },
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take: T.fetchBatchSize,
        });

        if (batch.length === 0) break;

        totalEligible += batch.length;
        totalQueued += await queuePromoNotificationJobsOrReturn({
          eventSlug: slug as PromoEventSlug,
          target: "CUSTOMER",
          recipientIds: batch.map((c) => c.id),
        });

        lastId = batch[batch.length - 1].id;
        if (batch.length < T.fetchBatchSize) break;
      }

      if (totalEligible > 0) {
        log.info(
          `(NUDGE_FIRST_SHARE) ${slug}: queued ${totalQueued} jobs for ${totalEligible} eligible customers`,
        );
      }
    }
  },
};
