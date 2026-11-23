import { z } from "zod";
import { MediaTypeSchema } from "../../../../core/enums";
import { MediaUidSchema } from "../../../../core/uids";

/**
 * A piece of media (image/video) as embedded in previews — banner, etc.
 * No `width`/`height` on the wire — renderers use `key` + `aspectRatio`.
 */
export const MediaPreviewSchema = z.object({
  uid: MediaUidSchema,
  key: z.string(),
  aspectRatio: z.number().positive(),
  type: MediaTypeSchema,
});

export type MediaPreview = z.infer<typeof MediaPreviewSchema>;
