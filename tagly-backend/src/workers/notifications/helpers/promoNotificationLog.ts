import type {
  AccountType,
  NotificationChannel,
} from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.js";

/**
 * The `PromoNotificationLog` read/write for the notifications worker. It records
 * one row per (recipient, promo event, channel) after a successful send, which
 * is BOTH the send-time idempotency guard (skip a resend on retry) AND the signal
 * the maintenance nudge schedulers read to never re-nudge someone. Only promo
 * events log here — admin blasts deduped via a content-hash `dedupeKey`
 * on the queue row.
 *
 * Occurrence scoping: a slug can legitimately fire more than once per recipient
 * (the inactivity reminders re-arm after each new share), so the log keeps ONE
 * row per (recipient, slug, channel) whose `sentAt` is refreshed on every send.
 * Reads take a `since` bound (the queue row's `createdAt`): a `sentAt >= since`
 * row means "already sent for THIS queued occurrence"; an older row is a
 * previous occurrence and doesn't block the send. The inactivity scheduler
 * compares `sentAt` against the customer's latest share for the same reason.
 *
 * Promo targets span all four recipient kinds (customer, advertiser, and both
 * pendings) — the target→column branch is kept here, out of the orchestrator.
 */

function ownerWhere(target: AccountType, recipientId: number) {
  return target === "CUSTOMER"
    ? { customerId: recipientId }
    : target === "PENDING_CUSTOMER"
      ? { pendingCustomerId: recipientId }
      : target === "ADVERTISER"
        ? { advertiserId: recipientId }
        : { pendingAdvertiserId: recipientId };
}

/** True if this promo (slug, channel) already went out for the occurrence that
 *  was queued at `since` — i.e. a prior attempt of this job (or its sibling
 *  fall-through) completed. Older log rows (a previous occurrence) don't count. */
export async function alreadySentPromo(
  target: AccountType,
  recipientId: number,
  eventSlug: string,
  channel: NotificationChannel,
  since: Date,
): Promise<boolean> {
  return (
    (await getPromoSentAt(target, recipientId, eventSlug, channel, since)) !==
    null
  );
}

/**
 * When this promo (slug, channel) was last sent to the recipient — bounded to
 * `sentAt >= since` when `since` is given (occurrence scoping), null if never.
 * The waterfall's escalation check reads the PUSH leg's `sentAt` (scoped to the
 * current occurrence) to decide whether the recipient came back after the push
 * (skip the email) or not (send it).
 */
export async function getPromoSentAt(
  target: AccountType,
  recipientId: number,
  eventSlug: string,
  channel: NotificationChannel,
  since?: Date,
): Promise<Date | null> {
  const sentAtBound = since ? { sentAt: { gte: since } } : {};
  const row = await prisma.promoNotificationLog.findFirst({
    where: {
      ...ownerWhere(target, recipientId),
      eventSlug,
      channel,
      ...sentAtBound,
    },
    select: { sentAt: true },
  });
  return row?.sentAt ?? null;
}

/** Record a successful promo send. Upsert keyed on (recipient, slug, channel);
 *  a re-send for a later occurrence refreshes `sentAt` (see header). */
export async function recordPromoSent(
  target: AccountType,
  recipientId: number,
  eventSlug: string,
  channel: NotificationChannel,
): Promise<void> {
  await prisma.promoNotificationLog.upsert({
    where:
      target === "CUSTOMER"
        ? {
            customerId_eventSlug_channel: {
              customerId: recipientId,
              eventSlug,
              channel,
            },
          }
        : target === "PENDING_CUSTOMER"
          ? {
              pendingCustomerId_eventSlug_channel: {
                pendingCustomerId: recipientId,
                eventSlug,
                channel,
              },
            }
          : target === "ADVERTISER"
            ? {
                advertiserId_eventSlug_channel: {
                  advertiserId: recipientId,
                  eventSlug,
                  channel,
                },
              }
            : {
                pendingAdvertiserId_eventSlug_channel: {
                  pendingAdvertiserId: recipientId,
                  eventSlug,
                  channel,
                },
              },
    create: { ...ownerWhere(target, recipientId), eventSlug, channel },
    update: { sentAt: new Date() },
  });
}
