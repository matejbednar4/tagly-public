import { z } from "zod";

/**
 * A share's quality rating as half-stars: 1–10 = ½★–5★ (the displayed star value
 * is `n / 2`). `null` = unrated. This is the canonical (and only) representation,
 * stored directly on the share (`Share.rating`, an int).
 */
export const RatingStarsSchema = z.number().int().min(1).max(10);
export type RatingStars = z.infer<typeof RatingStarsSchema>;

export const MIN_RATING_STARS = 1;
export const MAX_RATING_STARS = 10;
