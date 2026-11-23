import { z } from "zod";
import { EmailSchema } from "../../../../core/email";

/**
 * `POST /v2/public/auth/admin/verify` — step 2 of admin login: the emailed long
 * code. The session is resolved by `email` (the admin's LOGIN OTP session) — the
 * mobile-safe equivalent of the origin's same-device cookie, matching the v2
 * customer/advertiser verify flow.
 */
export const AdminVerifyOtpBodySchema = z.object({
  email: EmailSchema,
  code: z.string().min(1),
});
export type AdminVerifyOtpBody = z.infer<typeof AdminVerifyOtpBodySchema>;

/**
 * Response (200) — the session JWT as a **bearer token** in the body (stored in
 * the app's secure store, sent as `Authorization: Bearer`). v2 is cookie-free.
 */
export const AdminVerifyOtpResponseSchema = z.object({
  jwt: z.string(),
});
export type AdminVerifyOtpResponse = z.infer<typeof AdminVerifyOtpResponseSchema>;
