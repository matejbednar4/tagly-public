import prisma from "../../prisma/prisma.js";
import { LOCK_KEYS } from "../../constants/platform/POSTGRES_LOCKS.js";
import { notificationsWorkerTunables as T } from "../../constants/workers/NOTIFICATIONS.js";
import { runJobQueue } from "../runtime/runJobQueue.js";
import { reportWorkerError } from "../runtime/reportWorkerError.js";
import { executeNotificationJob } from "./helpers/executeNotificationJob.js";
import type { NotificationJob } from "./helpers/notificationJobTypes.js";
import { notificationEvents } from "../../constants/catalogs/notifications/notificationRegistry.js";
import type { AnyEventSlug } from "../../constants/catalogs/notifications/notificationRegistry.js";

const WORKER = "notifications";

/**
 * Notifications worker — sends queued email/push jobs. Claims SCHEDULED rows
 * FIFO (default claim), executes each (with send-time preference re-checks +
 * throttling inside `executeNotificationJob`), bounded by `T.concurrency`
 * per tick and, on the email leg, by the global Resend send budget (E057). A
 * permanent problem (unknown slug, opted-out recipient, no push token) fails
 * immediately; transient errors back off over ~45 minutes (E073).
 */
export function runNotificationsWorker() {
  return runJobQueue<NotificationJob>({
    name: WORKER,
    tunables: T,
    // Singleton: the in-process token-bucket throttles assume one replica, and
    // transactional PUSH has no delivery-side dedup — the ECS deploy overlap
    // would double the send rate and can double-send the same push.
    singleton: LOCK_KEYS.NOTIFICATIONS,
    table: prisma.notificationQueue,
    select: {
      id: true,
      attempts: true,
      scheduledAt: true,
      createdAt: true,
      target: true,
      recipientId: true,
      eventSlug: true,
      channel: true,
      payload: true,
      overwriteEmail: true,
    },
    execute: (job) => executeNotificationJob(job),
    jobLogContext: (job) => ({
      channel: job.channel,
      target: job.target,
      recipientId: job.recipientId,
      slug: job.eventSlug,
      // transactional | promo | admin — rides every log line and, critically,
      // the terminal-failure PostHog event, so an alert can key on dropped
      // TRANSACTIONAL notifications specifically (E073's dead-letter
      // visibility; promo slugs live only in the in-memory catalogs, hence
      // the registry lookup instead of a DB column).
      notificationType:
        notificationEvents[job.eventSlug as AnyEventSlug]?.notificationType ??
        "unknown",
    }),
  });
}

// --- process entry (invoked directly by ops/entrypoint.sh) ---
runNotificationsWorker().catch((e) => {
  reportWorkerError(e, { worker: WORKER, phase: "loop", fatal: true });
  process.exit(1);
});
