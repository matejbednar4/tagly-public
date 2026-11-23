import { z } from "zod";
import { NotificationChannelSchema } from "../../../../core/enums";

/**
 * One notification event's EFFECTIVE per-channel state for an account, as the
 * delivery path (`queueNotificationJobs`) would resolve it: a channel delivers
 * when it is mandatory OR explicitly enabled in the account's pref row (a
 * missing row = disabled except mandatory). `null` = the channel isn't
 * available for this event at all. Display labels come from the shared
 * notification catalog client-side — the wire carries slugs only.
 */
export const AdminNotificationPrefSchema = z.object({
  slug: z.string(),
  /** Effective push state; null when PUSH isn't an available channel. */
  push: z.boolean().nullable(),
  /** Effective email state; null when EMAIL isn't an available channel. */
  email: z.boolean().nullable(),
  /** Channels the account cannot turn off (e.g. ban/security emails). */
  mandatoryChannels: z.array(NotificationChannelSchema),
});
export type AdminNotificationPref = z.infer<typeof AdminNotificationPrefSchema>;
