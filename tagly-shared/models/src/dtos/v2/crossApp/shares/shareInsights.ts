import { z } from "zod";
import { IgPostTypeSchema } from "../../../../core/enums";

/**
 * Unified per-share Instagram insights: one object (not a per-post-type split),
 * with `postType` as the discriminator and every metric nullable
 * (IG returns them best-effort; fields not applicable to a media type are null,
 * e.g. `tapsForward` only on STORY, `igReelsAvgWatchTime` only on REEL).
 */
export const ShareInsightsSchema = z.object({
  postType: IgPostTypeSchema,

  // shared across types
  reach: z.number().nullable(),
  views: z.number().nullable(),
  shares: z.number().nullable(),
  totalInteractions: z.number().nullable(),
  follows: z.number().nullable(),
  profileVisits: z.number().nullable(),
  comments: z.number().nullable(),
  likes: z.number().nullable(),
  saved: z.number().nullable(),

  // STORY-only
  replies: z.number().nullable(),
  tapsForward: z.number().nullable(),
  tapsBack: z.number().nullable(),
  exits: z.number().nullable(),

  // REEL-only
  igReelsAvgWatchTime: z.number().nullable(),
});

export type ShareInsights = z.infer<typeof ShareInsightsSchema>;
