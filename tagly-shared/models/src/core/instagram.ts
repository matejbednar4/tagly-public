import { z } from "zod";
import { ISODateSchema } from "./time";
import { IgPostTypeSchema, MediaTypeSchema } from "./enums";

export const InstagramTagSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/^@+/, "").toLowerCase())
  .nullable();

export const InstagramPostSchema = z.object({
  id: z.string(),
  timestamp: ISODateSchema,
  mediaType: MediaTypeSchema,
  igPostType: IgPostTypeSchema.exclude(["STORY"]),
  mediaUrl: z.url(),
  thumbnailUrl: z.url().optional(),
});

export type InstagramPost = z.infer<typeof InstagramPostSchema>;

export const InstagramStorySchema = z.object({
  id: z.string(),
  timestamp: ISODateSchema,
  mediaType: MediaTypeSchema,
  igPostType: IgPostTypeSchema.exclude(["POST", "REEL"]),
  /**
   * `null` when Instagram withholds the story's media — the Graph API drops
   * `media_url` for copyright-flagged content (typically a music sticker).
   * Such a story is listed so clients can explain why it can't be shown, but
   * it is not shareable (`createShare` rejects it with 4107); see
   * `isInstagramStoryShareable`. The key is always present (nullable, never
   * omitted) so the wire shape stays what shipped clients expect.
   */
  mediaUrl: z.url().nullable(),
  thumbnailUrl: z.url().optional(),
});

export type InstagramStory = z.infer<typeof InstagramStorySchema>;

/**
 * Whether Instagram provided enough media for this story to be monetized: the
 * media itself, plus — for a VIDEO story — the thumbnail (needed for
 * dimensions + tag validation). The single canonical predicate shared by the
 * backend (`createShare`'s 4107 guard, the app-open nudge's candidate filter)
 * and the customer app (the picker renders non-shareable stories as a
 * "copyrighted music" placeholder that can't be selected).
 */
export const isInstagramStoryShareable = (story: {
  mediaUrl?: string | null;
  mediaType: string;
  thumbnailUrl?: string;
}): boolean =>
  !!story.mediaUrl && (story.mediaType !== "VIDEO" || !!story.thumbnailUrl);
