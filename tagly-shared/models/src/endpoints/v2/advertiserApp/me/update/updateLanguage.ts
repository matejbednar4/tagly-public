import { z } from "zod";
import { SupportedLanguageSchema } from "../../../../../core/locale";

/**
 * `POST /v2/advertisers/me/update/language` — set the logged-in advertiser's
 * preferred language (ISO 639-1: `en` | `cs`). Governs server-sent copy
 * (transactional push + email). The in-app display language is a separate
 * device-local preference, so this endpoint only changes what the backend
 * renders. No cooldown — switch as often as you like.
 */
export const UpdateLanguageBodySchema = z.object({
  language: SupportedLanguageSchema,
});
export type UpdateLanguageBody = z.infer<typeof UpdateLanguageBodySchema>;

export const UpdateLanguageResponseSchema = z.object({
  language: SupportedLanguageSchema,
});
export type UpdateLanguageResponse = z.infer<
  typeof UpdateLanguageResponseSchema
>;
