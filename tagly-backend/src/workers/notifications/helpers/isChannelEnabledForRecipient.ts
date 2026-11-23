import type {
  AccountType,
  NotificationChannel,
} from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.js";
import { resolveEffectiveChannels } from "../../../utils/notifications/resolveEffectiveChannels.js";

/**
 * Send-time preference re-check for transactional events (defense-in-depth
 * behind the queue-time resolution). Same shared opt-out rule as
 * `queueNotificationJobs`: a missing `NotificationEventOptOut` row means every
 * available channel is on; mandatory channels always send.
 */
export async function isChannelEnabledForRecipient(params: {
  target: AccountType;
  recipientId: number;
  eventSlug: string;
  channel: NotificationChannel;
}): Promise<boolean> {
  const { target, recipientId, eventSlug, channel } = params;

  const event = await prisma.notificationEvent.findUnique({
    where: { slug: eventSlug },
    select: {
      id: true,
      availableChannels: true,
      mandatoryChannels: true,
    },
  });
  if (!event) return false;

  if (target !== "ADVERTISER" && target !== "CUSTOMER") return false;

  const optOut = await prisma.notificationEventOptOut.findUnique({
    where:
      target === "ADVERTISER"
        ? {
            advertiserId_eventId: {
              advertiserId: recipientId,
              eventId: event.id,
            },
          }
        : {
            customerId_eventId: { customerId: recipientId, eventId: event.id },
          },
    select: { disabledChannels: true },
  });

  return resolveEffectiveChannels({
    available: event.availableChannels,
    mandatory: event.mandatoryChannels,
    disabled: optOut?.disabledChannels ?? [],
  }).has(channel);
}
