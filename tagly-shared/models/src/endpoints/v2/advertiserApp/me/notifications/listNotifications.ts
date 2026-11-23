import { z } from "zod";
import {
  SettingsNotificationChannelSchema,
  NotificationCategoryWithEventsSchema,
} from "../../../../../dtos/v2/crossApp/me/notifications/notificationSettings";

/**
 * `GET /v2/advertisers/me/notifications?channel=PUSH|EMAIL` — the advertiser's
 * configurable notifications for one channel, grouped by category with every
 * event resolved to its effective on/off + mandatory state. One fetch renders the
 * whole screen (no per-category lazy loading). Same shapes as the customer
 * endpoint — the DTO lives in `crossApp`.
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
