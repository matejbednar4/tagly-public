import { z } from "zod";

/**
 * A customer interest as returned in lists (e.g. embedded in `CustomerMe`). v2
 * wire — `slug` is the source of truth; clients look up the localized label
 * from the `@tagly/models` catalog by slug; the wire never carries an English
 * `name`.
 */
export const InterestInListSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  sortOrder: z.number().int().nonnegative(),
  verticals: z.array(z.object({ id: z.number() })),
});
export type InterestInList = z.infer<typeof InterestInListSchema>;
