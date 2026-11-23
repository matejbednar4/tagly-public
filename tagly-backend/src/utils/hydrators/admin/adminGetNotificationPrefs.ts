import prisma from "../../../prisma/prisma.js";
import type { AccountType } from "../../../generated/prisma/client.js";
import type { AdminNotificationPref } from "@tagly/models/v2/adminApp";

/**
 * The per-event EFFECTIVE push/email state for one account — the admin-detail
 * view of what `queueNotificationJobs` would actually deliver: a channel is on
 * unless the account's `NotificationEventOptOut` row disables it (opt-out
 * storage — a missing row = everything on; mandatory is always on); `null` when
 * the channel isn't available for the event at all. ACTIVE events only, catalog
 * order. Shared by `adminHydrateCustomer` and `adminHydrateAdvertiser`.
 */
export async function adminGetNotificationPrefs({
  target,
  accountId,
}: {
  target: AccountType;
  accountId: number;
}): Promise<AdminNotificationPref[]> {
  const [events, prefRows] = await Promise.all([
    prisma.notificationEvent.findMany({
      where: { target, status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        availableChannels: true,
        mandatoryChannels: true,
      },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    }),
    prisma.notificationEventOptOut.findMany({
      where:
        target === "CUSTOMER"
          ? { customerId: accountId }
          : { advertiserId: accountId },
      select: { eventId: true, disabledChannels: true },
    }),
  ]);

  const optOutByEventId = new Map(prefRows.map((o) => [o.eventId, o]));

  return events.map((event) => {
    const optOut = optOutByEventId.get(event.id);
    const effective = (channel: "PUSH" | "EMAIL"): boolean | null => {
      if (!event.availableChannels.includes(channel)) return null;
      if (event.mandatoryChannels.includes(channel)) return true;
      return !(optOut?.disabledChannels.includes(channel) ?? false);
    };
    return {
      slug: event.slug,
      push: effective("PUSH"),
      email: effective("EMAIL"),
      mandatoryChannels: event.mandatoryChannels,
    };
  });
}
