import { NotificationChannel } from "../../generated/prisma/client.js";

/**
 * The one channel-resolution rule for notification delivery — shared by
 * `queueNotificationJobs` and the worker's send-time
 * re-check (`isChannelEnabledForRecipient`), so queue time and send time can
 * never disagree.
 *
 * Preferences are opt-OUT: `disabled` is the recipient's
 * `NotificationEventOptOut` row for the event (absent row = nothing disabled =
 * every available channel on — which is what makes newly-added catalog events
 * on-by-default for every account with no backfill). Effective channels:
 *
 *   (mandatory ∩ available) ∪ ((limitChannels ∩ available or available) − disabled)
 *
 * minus IN_APP (not yet supported). Mandatory channels can never be opted out.
 * A non-empty `limitChannels` that intersects `available` to nothing yields
 * mandatory-only (the caller asked for channels this event doesn't offer).
 */
export function resolveEffectiveChannels({
  available,
  mandatory,
  limitChannels,
  disabled,
}: {
  available: NotificationChannel[];
  mandatory: NotificationChannel[];
  limitChannels?: NotificationChannel[];
  disabled: NotificationChannel[];
}): Set<NotificationChannel> {
  const requested =
    limitChannels && limitChannels.length > 0
      ? limitChannels.filter((ch) => available.includes(ch))
      : available;

  const effective = new Set<NotificationChannel>();
  for (const ch of mandatory) {
    if (available.includes(ch)) effective.add(ch);
  }
  for (const ch of requested) {
    if (!disabled.includes(ch)) effective.add(ch);
  }
  effective.delete(NotificationChannel.IN_APP);
  return effective;
}
