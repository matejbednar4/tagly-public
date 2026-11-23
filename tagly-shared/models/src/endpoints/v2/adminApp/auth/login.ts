import { z } from "zod";
import { EmailSchema } from "../../../../core/email";

/**
 * `POST /v2/public/auth/admin/login` — step 1 of admin login: email + password.
 *
 * The team-domain rule (`@taglyapp.com` / legacy `@flaer.app`) is enforced in the
 * controller, NOT here: a schema
 * rejection would leak (a different response for a non-team email) and break the
 * generic, constant-shape response that prevents account enumeration. The schema
 * only checks a well-formed email + a non-empty password.
 */
export const AdminLoginBodySchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});
export type AdminLoginBody = z.infer<typeof AdminLoginBodySchema>;

/**
 * Response (200) — always the same generic message regardless of whether the
 * email exists or the password matched (anti-enumeration). On valid credentials
 * a long verification code is emailed; the client proceeds to the verify step
 * either way.
 */
export const AdminLoginResponseSchema = z.object({
  message: z.string(),
});
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>;
