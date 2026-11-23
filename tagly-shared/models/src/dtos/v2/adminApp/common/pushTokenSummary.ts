import { z } from "zod";

/**
 * Coarse push-notification reach for an account: how many active (non-disabled)
 * push tokens it has and on which platforms. Enough for admin to see "can we
 * push to this user, and from what devices" without dumping every token row.
 */
export const PushTokenSummarySchema = z.object({
  activeCount: z.number(),
  platforms: z.array(z.string()),
});
export type PushTokenSummary = z.infer<typeof PushTokenSummarySchema>;
export type PushTokenSummaryInput = z.input<typeof PushTokenSummarySchema>;
