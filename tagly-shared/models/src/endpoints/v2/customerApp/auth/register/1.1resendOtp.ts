import { z } from "zod";
import { EmailSchema } from "../../../../../core/email";

/**
 * `POST /v2/public/auth/customers/resend-otp` — resend the email OTP for an
 * in-progress login or registration. The backend reuses the existing OTP
 * session (respecting resend rate limits) keyed off the email.
 */
export const ResendOtpBodySchema = z.object({
  email: EmailSchema,
});
export type ResendOtpBody = z.infer<typeof ResendOtpBodySchema>;

/** Response */
export const ResendOtpResponseSchema = z.object({
  message: z.string(),
});
export type ResendOtpResponse = z.infer<typeof ResendOtpResponseSchema>;
