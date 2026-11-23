import { z } from "zod";
import { EmailSchema } from "../../../../../core/email";

/**
 * `POST /v2/customers/me/email/start-change` — begin a dual-OTP email change:
 * sends a code to the customer's CURRENT email and to the NEW email. Idempotent
 * (a recently-sent code just proceeds — the client gates resend on its cooldown).
 * Errors: 409 if the new email is the same as the current (1103) or already
 * registered to another account (1102).
 */
export const StartChangeEmailBodySchema = z.object({
  newEmail: EmailSchema,
});
export type StartChangeEmailBody = z.infer<typeof StartChangeEmailBodySchema>;

export const StartChangeEmailResponseSchema = z.object({
  message: z.string(),
});
export type StartChangeEmailResponse = z.infer<
  typeof StartChangeEmailResponseSchema
>;
