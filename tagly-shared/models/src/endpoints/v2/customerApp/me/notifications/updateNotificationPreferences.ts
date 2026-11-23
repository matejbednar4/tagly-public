import { z } from "zod";
import { SettingsNotificationChannelSchema } from "../../../../../dtos/v2/crossApp/me/notifications/notificationSettings";

/**
 * `POST /v2/customers/me/notifications/preferences` — set the on/off state of one
 * or more events on a channel. The client sends a single update per toggle
 * (instant-persist), but the body accepts a batch. Turning off a mandatory
 * channel is rejected (reported in `rejected`, never throws for that alone).
 */
export const UpdateNotificationPreferencesBodySchema = z.object({
  updates: z
    .array(
      z.object({
        eventId: z.number(),
        channel: SettingsNotificationChannelSchema,
        enabled: z.boolean(),
      }),
    )
    .min(1),
});
export type UpdateNotificationPreferencesBody = z.infer<
  typeof UpdateNotificationPreferencesBodySchema
>;

export const UpdateNotificationPreferencesResponseSchema = z.object({
  applied: z.number(),
  rejected: z.array(
    z.object({
      eventId: z.number(),
      channel: SettingsNotificationChannelSchema,
      reason: z.string(),
    }),
  ),
});
export type UpdateNotificationPreferencesResponse = z.infer<
  typeof UpdateNotificationPreferencesResponseSchema
>;
