import { z } from "zod";
import { EmailSchema } from "../../../../../core/email";

/**
 * `POST /v2/customers/me/email/verify-change` — finish the email change: verify
 * BOTH OTP codes (current inbox + new inbox), then atomically swap the email and
 * notify the old address. Requires a prior `start-change`. OTP errors surface via
 * the shared OTP error codes (invalid/expired/etc.).
 */
export const VerifyChangeEmailBodySchema = z.object({
  currentOtp: z.string().min(1),
  newOtp: z.string().min(1),
});
export type VerifyChangeEmailBody = z.infer<
  typeof VerifyChangeEmailBodySchema
>;

export const VerifyChangeEmailResponseSchema = z.object({
  newEmail: EmailSchema,
});
export type VerifyChangeEmailResponse = z.infer<
  typeof VerifyChangeEmailResponseSchema
>;
