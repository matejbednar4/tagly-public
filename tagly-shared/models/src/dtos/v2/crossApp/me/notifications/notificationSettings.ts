import { z } from "zod";

/**
 * Channels the notification settings screens expose. `IN_APP` is delivered
 * unconditionally and isn't user-configurable, so it never reaches the wire here.
 *
 * Account-agnostic: both the customer and advertiser notification settings
 * screens (and their `/me/notifications` endpoints) render from these exact
 * shapes, so the DTO lives in `crossApp` as the single source of truth.
 */
export const SettingsNotificationChannelSchema = z.enum(["PUSH", "EMAIL"]);
export type SettingsNotificationChannel = z.infer<
  typeof SettingsNotificationChannelSchema
>;

/**
 * One configurable notification event, resolved for a single channel.
 *
 * `slug` localizes the label + description via the shared catalog
 * (`useCatalogLocalizer`) — the wire carries no English copy. `enabled` is the
 * effective on/off for the requested channel; `mandatory` means it can't be
 * turned off on this channel (security / legal), so the client renders it as a
 * locked "always on" row instead of a switch.
 */
export const NotificationEventPrefSchema = z.object({
  id: z.number(),
  slug: z.string(),
  enabled: z.boolean(),
  mandatory: z.boolean(),
});
export type NotificationEventPref = z.infer<typeof NotificationEventPrefSchema>;

/**
 * A notification category with its configurable events for one channel. `slug`
 * localizes the category name via the shared catalog. Categories with no events
 * on the requested channel are omitted by the backend.
 */
export const NotificationCategoryWithEventsSchema = z.object({
  slug: z.string(),
  events: z.array(NotificationEventPrefSchema),
});
export type NotificationCategoryWithEvents = z.infer<
  typeof NotificationCategoryWithEventsSchema
>;
