import { z } from "zod";
import {
  SettingsNotificationChannelSchema,
  NotificationCategoryWithEventsSchema,
} from "../../../../../dtos/v2/crossApp/me/notifications/notificationSettings";

/**
 * `GET /v2/customers/me/notifications?channel=PUSH|EMAIL` — the customer's
 * configurable notifications for one channel, grouped by category with every
 * event resolved to its effective on/off + mandatory state. One fetch renders the
 * whole screen (no per-category lazy loading).
 */
export const ListNotificationSettingsQuerySchema = z.object({
  channel: SettingsNotificationChannelSchema,
});
export type ListNotificationSettingsQuery = z.infer<
  typeof ListNotificationSettingsQuerySchema
>;

export const ListNotificationSettingsResponseSchema = z.object({
  channel: SettingsNotificationChannelSchema,
  categories: z.array(NotificationCategoryWithEventsSchema),
});
export type ListNotificationSettingsResponse = z.infer<
  typeof ListNotificationSettingsResponseSchema
>;
