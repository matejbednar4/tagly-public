import {
  Prisma,
  NotificationChannel,
  NotificationEventStatus,
  AccountType,
} from "../../generated/prisma/client.js";
import {
  AdvertiserEventSlug,
  CustomerEventSlug,
} from "../../constants/catalogs/notifications/notificationRegistry.js";
import prisma from "../../prisma/prisma.js";
import { reportError } from "../core/errors/reportError.js";
import { resolveEffectiveChannels } from "../notifications/resolveEffectiveChannels.js";

type BaseArgs = {
  payload?: Prisma.InputJsonValue;
  limitChannels?: NotificationChannel[];
  dedupeKey?: string;
  scheduleAt?: Date;
  overwriteEmail?: string;
  /**
   * Optional transaction client. When the notification must be atomic with a
   * state change (the transactional-outbox pattern — e.g. a share void that
   * must either commit WITH its queue row or not at all), pass the caller's
   * `tx` so the event lookup, prefs read, and queue write all ride the same
   * transaction: a rollback then erases the queue row too, and the worker only
   * sees it after commit. Without it, the global client is used (the default,
   * fire-after-commit pattern).
   *
   * ⚠️ With `tx`, "never throws" means a swallowed failure inside YOUR open
   * transaction — the notification is silently skipped but your tx still
   * commits, same contract as without.
   */
  tx?: Prisma.TransactionClient;
};

/**
 * The audience is a discriminated union: pass `advertiserIds` with an advertiser
 * event slug, or `customerIds` with a customer event slug. The slug type is
 * matched to the audience so you can't mis-pair them.
 */
export type QueueNotificationJobsArgs = BaseArgs &
  (
    | {
        advertiserIds: number[];
        eventSlug: AdvertiserEventSlug;
        customerIds?: never;
      }
    | {
        customerIds: number[];
        eventSlug: CustomerEventSlug;
        advertiserIds?: never;
      }
  );

/**
 * Enqueue notification jobs for a set of customers OR advertisers (one call, one
 * audience). Channels are resolved via the shared opt-out rule
 * (`resolveEffectiveChannels`): every available channel is queued unless the
 * recipient's `NotificationEventOptOut` row disables it — a missing row means
 * everything is on; mandatory channels always send; IN_APP is excluded until
 * implemented.
 *
 * **Best-effort by design — it never throws.** Any failure (bad slug, DB error,
 * wrong-target event, …) is logged and the call resolves to `0`, so callers can
 * `await` it without a `.catch`: a notification hiccup must never break the action
 * that triggered it. Returns the number of queue rows created.
 */
export async function queueNotificationJobs(
  args: QueueNotificationJobsArgs,
): Promise<number> {
  try {
    const { payload, limitChannels, dedupeKey, scheduleAt, overwriteEmail } =
      args;
    const eventSlug = args.eventSlug;
    // Outbox mode: ride the caller's transaction when provided.
    const db = args.tx ?? prisma;

    // Resolve the audience + its notification target. Narrowing on the id value
    // (not `in`) keeps it correct alongside the `?: never` mutual-exclusion.
    const recipientIds =
      args.advertiserIds !== undefined ? args.advertiserIds : args.customerIds;
    const target =
      args.advertiserIds !== undefined ? AccountType.ADVERTISER : AccountType.CUSTOMER;

    if (recipientIds.length === 0) return 0;

    // 1) Validate the event: exists, targets this audience, and is ACTIVE.
    const event = await db.notificationEvent.findUnique({
      where: { slug: eventSlug },
      select: {
        id: true,
        target: true,
        status: true,
        availableChannels: true,
        mandatoryChannels: true,
      },
    });
    if (!event) return 0;
    if (event.target !== target) return 0;
    if (event.status !== NotificationEventStatus.ACTIVE) return 0;

    // 2) Load recipient opt-outs for this event. A missing row means nothing
    //    is disabled — every available channel is on (opt-out storage).
    const optOutRows = await db.notificationEventOptOut.findMany({
      where:
        args.advertiserIds !== undefined
          ? { advertiserId: { in: recipientIds }, eventId: event.id }
          : { customerId: { in: recipientIds }, eventId: event.id },
      select: {
        customerId: true,
        advertiserId: true,
        disabledChannels: true,
      },
    });
    const disabledById = new Map<number, NotificationChannel[]>();
    for (const o of optOutRows) {
      const recipientId = o.advertiserId ?? o.customerId;
      if (recipientId === null) continue;
      disabledById.set(
        recipientId,
        (o.disabledChannels as NotificationChannel[]) ?? [],
      );
    }

    // 3) Resolve channels per recipient via the shared opt-out rule
    //    ((mandatory ∩ available) ∪ (requested ∩ available − disabled), no
    //    IN_APP) and build the queue rows.
    const available = (event.availableChannels as NotificationChannel[]) ?? [];
    const mandatory = (event.mandatoryChannels as NotificationChannel[]) ?? [];

    const rows: Prisma.NotificationQueueCreateManyInput[] = [];
    const when = scheduleAt ?? new Date();
    const key = dedupeKey ?? null;

    for (const recipientId of recipientIds) {
      const effective = resolveEffectiveChannels({
        available,
        mandatory,
        limitChannels,
        disabled: disabledById.get(recipientId) ?? [],
      });

      for (const ch of effective) {
        rows.push({
          target,
          recipientId,
          eventSlug,
          channel: ch,
          payload,
          scheduledAt: when,
          dedupeKey: key,
          status: "SCHEDULED",
          attempts: 0,
          lastError: null,
          overwriteEmail,
        });
      }
    }

    if (rows.length === 0) return 0;

    const res = await db.notificationQueue.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return res.count;
  } catch (e) {
    // Best-effort by contract (we never fail the caller over a notification),
    // but a failure here means users silently don't get notified — report it so
    // it's visible instead of dying in a write-only log.
    reportError(e, {
      source: "system",
      errorClass: "unexpected",
      service: "notifications-queue",
    });
    return 0;
  }
}
