import { z } from "zod";

/**
 * `POST /v2/customers/me/update/name` — update the logged-in customer's display
 * name. The field is `fullName` (matching the `CustomerMe` DTO). Trimmed +
 * non-empty; no cooldown on the name.
 */
export const UpdateNameBodySchema = z.object({
  fullName: z.string().trim().min(1).max(100),
});
export type UpdateNameBody = z.infer<typeof UpdateNameBodySchema>;

export const UpdateNameResponseSchema = z.object({
  fullName: z.string(),
});
export type UpdateNameResponse = z.infer<typeof UpdateNameResponseSchema>;
