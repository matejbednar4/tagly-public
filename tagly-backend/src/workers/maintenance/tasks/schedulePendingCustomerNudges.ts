import prisma from "../../../prisma/prisma.js";
import { promoEventsRaw } from "../../../constants/catalogs/notifications/promoCatalog.js";
import { queuePromoNotificationJobsOrReturn } from "../../../utils/queue/queuePromoNotificationJobsOrReturn.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import type { PromoEventSlug } from "../../../constants/catalogs/notifications/promoCatalog.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Queues "finish registration" nudge notifications for PendingCustomers who
 * have verified their email but not completed registration.
 *
 * Each step targets a non-overlapping time window relative to PendingCustomer.createdAt,
 * so a customer is in exactly one window at a time and receives at most one step per run.
 * Already-notified recipients are excluded via PromoNotificationLog, written by
 * the notification worker after each successful send.
 */
export const schedulePendingCustomerNudges: MaintenanceTask = {
  name: "schedule pending-customer nudges",
  run: async ({ now, log }) => {
    for (const [slug, event] of Object.entries(promoEventsRaw)) {
      if (event.cadence.kind !== "pendingCustomerNudge") continue;

      const { minHours, maxHours } = event.cadence;
      const minAgo = new Date(now.getTime() - minHours * 60 * 60 * 1000);
      const maxAgo = new Date(now.getTime() - maxHours * 60 * 60 * 1000);

      let totalEligible = 0;
      let totalQueued = 0;
      let lastId = 0;

      while (true) {
        const batch = await prisma.pendingCustomer.findMany({
          where: {
            id: { gt: lastId },
            emailVerified: true,
            // Explicit marketing consent only. The column is nullable — null
            // means the user never reached/answered the consent step, which is
            // NOT consent (E056).
            promoNotificationsEnabled: true,
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
          target: "PENDING_CUSTOMER",
          recipientIds: batch.map((p) => p.id),
        });

        lastId = batch[batch.length - 1].id;
        if (batch.length < T.fetchBatchSize) break;
      }

      if (totalEligible > 0) {
        log.info(
          `(NUDGE_PENDING) ${slug}: queued ${totalQueued} jobs for ${totalEligible} eligible users`,
        );
      }
    }
  },
};
