import { z } from "zod";

/**
 * A business's category, by slug. The localized display name is looked up
 * client-side from `@tagly/models` catalogs (`advertiserTypeBySlug`), so the
 * wire carries only the slug (never an English `name`).
 */
export const BusinessTypePreviewSchema = z.object({
  slug: z.string(),
});

export type BusinessTypePreview = z.infer<typeof BusinessTypePreviewSchema>;
