import { z } from "zod";
import { SupportedLocaleSchema } from "../../../../../core/locale";

/**
 * Self-serve region correction (US↔CZ) for a customer whose `locale` was
 * mis-derived at onboarding (e.g. a CZ user auto-assigned `US`), so their payout
 * account would be created in the wrong country. Only valid **before** a Stripe
 * Connect account exists (its country is locked at creation) — the backend rejects
 * it otherwise (→ contact support). Also flips currency display + EU treatment.
 */
export const UpdateLocaleBodySchema = z.object({
  locale: SupportedLocaleSchema,
});
export type UpdateLocaleBody = z.infer<typeof UpdateLocaleBodySchema>;

export const UpdateLocaleResponseSchema = z.object({
  locale: SupportedLocaleSchema,
});
export type UpdateLocaleResponse = z.infer<typeof UpdateLocaleResponseSchema>;
