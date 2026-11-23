import { z } from "zod";

/**
 * `POST /v2/admin/logout` — server-side token revocation. Bumps the admin's
 * `jwtVersion` so every live token for that admin fails at `verifyJwt`; the
 * client also discards its stored bearer. No body. Bearer-based v2, so there is
 * no cookie to clear.
 */
export const AdminLogoutResponseSchema = z.object({
  message: z.string(),
});
export type AdminLogoutResponse = z.infer<typeof AdminLogoutResponseSchema>;
