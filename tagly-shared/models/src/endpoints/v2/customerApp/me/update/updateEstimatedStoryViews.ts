import { z } from "zod";

/**
 * `POST /v2/customers/me/update/estimated-story-views` — set (or clear with
 * null) the customer's self-reported "typical story views", the reach fallback
 * the estimate pricer uses when no usable Instagram data exists. Server-owned
 * (E062): estimates are priced from this stored value — never from a request
 * param — so the reward-estimate cache stays valid (the write bumps the
 * customer's reward-est generation) and the value follows the account across
 * devices. No cooldown. Ignored once a snapshot exists (real data wins).
 */
export const UpdateEstimatedStoryViewsBodySchema = z.object({
  // Upper bound is input hardening only (pricing caps apply regardless).
  estimatedStoryViews: z.number().int().positive().max(10_000_000).nullable(),
});
export type UpdateEstimatedStoryViewsBody = z.infer<
  typeof UpdateEstimatedStoryViewsBodySchema
>;

export const UpdateEstimatedStoryViewsResponseSchema = z.object({
  estimatedStoryViews: z.number().int().positive().nullable(),
});
export type UpdateEstimatedStoryViewsResponse = z.infer<
  typeof UpdateEstimatedStoryViewsResponseSchema
>;
