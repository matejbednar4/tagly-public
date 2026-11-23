import { z } from "zod";
import { SupportedLocaleSchema } from "../../../core/locale";

/**
 * `POST /v2/public/suggest-locale` request/response schemas. The shared
 * building block `SupportedLocaleSchema` lives in `core/` (permanent).
 *
 * Body — both fields optional; the client sends whichever device locale signals
 * it has (timezone + region from `Intl` / `expo-localization`).
 */
export const SuggestLocaleBodySchema = z.object({
  timezone: z.string().trim().min(1).max(64).optional(),
  deviceRegion: z.string().trim().min(1).max(16).optional(),
});
export type SuggestLocaleBody = z.infer<typeof SuggestLocaleBodySchema>;

/**
 * `locale` is null when the platform can't confidently guess (the two device
 * signals disagree or one is missing) — the client must then show the locale
 * picker. A non-null value is the confident guess.
 */
export const SuggestLocaleResponseSchema = z.object({
  message: z.string(),
  locale: SupportedLocaleSchema.nullable(),
});
export type SuggestLocaleResponse = z.infer<typeof SuggestLocaleResponseSchema>;
