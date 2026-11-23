import { Prisma, NotificationChannel, AccountType } from "../../generated/prisma/client.js";
import type { PromoEventSlug } from "../../constants/catalogs/notifications/promoCatalog.js";
import { promoEventsRaw } from "../../constants/catalogs/notifications/promoCatalog.js";
import { PROMO_DELIVERY } from "../../constants/notifications/PROMO_DELIVERY.js";
import prisma from "../../prisma/prisma.js";
import { reportError } from "../core/errors/reportError.js";
import {
  promoJitterSeed,
  resolvePromoTimezone,
  snapToQuietHours,
} from "./promoSendTime.js";

/**
 * Enqueue promo notification jobs directly from the catalog, applying the
 * delivery policy (`PROMO_DELIVERY`):
 *
 * **Waterfall** — a step offering PUSH + EMAIL never double-blasts. A
 * recipient with an ACTIVE push token gets the PUSH now plus the EMAIL leg
 * queued `ESCALATION_DELAY_MS` after it (the send-time escalation check in
 * `executeNotificationJob` skips that email if they opened the app in
 * between). A recipient with no active token gets the EMAIL immediately.
 * Push-only steps simply skip push-unreachable recipients.
 *
 * **Quiet hours** — every `scheduledAt` is snapped into the recipient's local
 * [8:00, 20:00) window; snapped times carry a deterministic per-(recipient,
 * step, channel) jitter so a morning's snapped sends spread out instead of
 * stacking at 8:00 sharp. Timezone = the freshest active token's
 * device-reported zone, else the recipient locale's market default, else the
 * fallback (see `promoSendTime.ts`; every zone is validated, never throws).
 * The worker re-snaps at send time too (backlog/retry drift) — this is the
 * initial placement, not the last word.
 *
 * Gating (checked at queue time):
 *   - All channels: promoNotificationsEnabled must be an explicit `true`
 *     (E056 — null on the pending targets means "never consented", not consent)
 *   - PUSH: an ACTIVE (`disabledAt: null`) PushToken row must exist
 *
 * Dedup: dedupeKey is set to eventSlug so the queue's
 *   @@unique([target, recipientId, eventSlug, channel, dedupeKey]) prevents double-queuing.
 *   Callers are also responsible for filtering already-notified recipients via PromoNotificationLog.
 *
 * `scheduleAt` (optional) is the earliest-send floor — quiet-hours snapping
 * still applies on top of it.
 *
 * Covers all four promo recipient targets (customers, advertisers, and both
 * pending kinds). The pending-customer and pending-advertiser schedulers also
 * gate on `promoNotificationsEnabled: true` in their where-clauses; this
 * util's strict opt-out check is the second layer of the same rule.
 */
export async function queuePromoNotificationJobsOrReturn(args: {
  eventSlug: PromoEventSlug;
  target: "CUSTOMER" | "PENDING_CUSTOMER" | "ADVERTISER" | "PENDING_ADVERTISER";
  recipientIds: number[];
  payload?: Prisma.InputJsonValue;
  scheduleAt?: Date;
}): Promise<number> {
  try {
    const { eventSlug, target, recipientIds, payload, scheduleAt } = args;

    if (recipientIds.length === 0) return 0;

    const event = promoEventsRaw[eventSlug];
    if (!event) return 0;

    const channels = Array.from<NotificationChannel>(event.availableChannels);
    if (channels.length === 0) return 0;
    const hasPushChannel = channels.includes(NotificationChannel.PUSH);
    const hasEmailChannel = channels.includes(NotificationChannel.EMAIL);

    const recipientSelect = {
      id: true,
      promoNotificationsEnabled: true,
      locale: true,
    } as const;
    const [recipientRows, pushTokens] = await Promise.all([
      target === "CUSTOMER"
        ? prisma.customer.findMany({
            where: { id: { in: recipientIds } },
            select: recipientSelect,
          })
        : target === "PENDING_CUSTOMER"
          ? prisma.pendingCustomer.findMany({
              where: { id: { in: recipientIds } },
              select: recipientSelect,
            })
          : target === "ADVERTISER"
            ? prisma.advertiser.findMany({
                where: { id: { in: recipientIds } },
                select: recipientSelect,
              })
            : prisma.pendingAdvertiserAccount.findMany({
                where: { id: { in: recipientIds } },
                select: recipientSelect,
              }),
      // ACTIVE tokens only — a disabled token (uninstall, permission reported
      // off) must not count as push-reachable, or the waterfall would pick a
      // dead channel and the email leg would wait 24h for nothing.
      prisma.pushToken.findMany({
        where: {
          disabledAt: null,
          ...(target === "CUSTOMER"
            ? { customerId: { in: recipientIds } }
            : target === "PENDING_CUSTOMER"
              ? { pendingCustomerId: { in: recipientIds } }
              : target === "ADVERTISER"
                ? { advertiserId: { in: recipientIds } }
                : { pendingAdvertiserId: { in: recipientIds } }),
        },
        select: {
          customerId: true,
          pendingCustomerId: true,
          advertiserId: true,
          pendingAdvertiserId: true,
          timezone: true,
          lastSeenAt: true,
        },
      }),
    ]);

    const recipientById = new Map(
      recipientRows.map((r) => [
        r.id,
        // Strict consent: anything but an explicit true is opted out. For
        // Customer/Advertiser the column is non-nullable (default true), so
        // this is identical to the old `=== false`; for the two PENDING
        // targets the column is null until the consent step is answered, and
        // null must NOT be treated as consent (E056).
        { optedOut: r.promoNotificationsEnabled !== true, locale: r.locale },
      ]),
    );

    // Freshest active token per recipient wins — its device-reported timezone
    // is the ground truth for quiet-hours placement.
    const bestTokenById = new Map<
      number,
      { timezone: string | null; lastSeenAt: Date | null }
    >();
    for (const pt of pushTokens) {
      const ownerId =
        pt.customerId ??
        pt.pendingCustomerId ??
        pt.advertiserId ??
        pt.pendingAdvertiserId;
      if (ownerId === null) continue;
      const prev = bestTokenById.get(ownerId);
      const prevSeen = prev?.lastSeenAt?.getTime() ?? -1;
      const curSeen = pt.lastSeenAt?.getTime() ?? -1;
      if (!prev || curSeen >= prevSeen) {
        bestTokenById.set(ownerId, {
          timezone: pt.timezone,
          lastSeenAt: pt.lastSeenAt,
        });
      }
    }

    const rows: Prisma.NotificationQueueCreateManyInput[] = [];
    const base = scheduleAt ?? new Date();
    const baseRow = {
      target: target as AccountType,
      eventSlug,
      payload,
      dedupeKey: eventSlug, // prevents double-queuing via @@unique
      status: "SCHEDULED" as const,
      attempts: 0,
      lastError: null,
    };

    for (const recipientId of recipientIds) {
      const recipient = recipientById.get(recipientId);
      if (!recipient || recipient.optedOut) continue;

      const bestToken = bestTokenById.get(recipientId);
      const timeZone = resolvePromoTimezone(
        bestToken?.timezone,
        recipient.locale,
      );
      const pushReachable = hasPushChannel && bestToken !== undefined;

      if (pushReachable) {
        const pushAt = snapToQuietHours(
          base,
          timeZone,
          promoJitterSeed(target, recipientId, eventSlug, "PUSH"),
          { spreadInWindow: true },
        );
        rows.push({
          ...baseRow,
          recipientId,
          channel: NotificationChannel.PUSH,
          scheduledAt: pushAt,
        });
        if (hasEmailChannel) {
          // Escalation leg: 24h after the push actually goes out, re-snapped
          // into the window. Skipped at send time if the recipient came back.
          rows.push({
            ...baseRow,
            recipientId,
            channel: NotificationChannel.EMAIL,
            scheduledAt: snapToQuietHours(
              new Date(pushAt.getTime() + PROMO_DELIVERY.ESCALATION_DELAY_MS),
              timeZone,
              promoJitterSeed(target, recipientId, eventSlug, "EMAIL"),
              { spreadInWindow: true },
            ),
          });
        }
      } else if (hasEmailChannel) {
        rows.push({
          ...baseRow,
          recipientId,
          channel: NotificationChannel.EMAIL,
          scheduledAt: snapToQuietHours(
            base,
            timeZone,
            promoJitterSeed(target, recipientId, eventSlug, "EMAIL"),
            { spreadInWindow: true },
          ),
        });
      }
      // Push-only step + no active token → skip; later steps still reach them.
    }

    if (rows.length === 0) return 0;

    const res = await prisma.notificationQueue.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return res.count;
  } catch (e) {
    // Best-effort by contract; report the swallow so a broken promo-notification
    // enqueue is visible instead of dying in a write-only log.
    reportError(e, {
      source: "system",
      errorClass: "unexpected",
      service: "notifications-queue",
    });
    return 0;
  }
}
