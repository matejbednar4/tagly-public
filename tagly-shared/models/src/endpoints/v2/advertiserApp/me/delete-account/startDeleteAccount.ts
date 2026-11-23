import { z } from "zod";

/**
 * `POST /v2/advertisers/me/delete-account/start` — send an account-deletion code
 * (`ACCOUNT_DELETION` OTP) to the advertiser's current email. Idempotent (a
 * recently-sent code just proceeds — the client gates resend on its cooldown).
 * No body: the account is identified by the JWT.
 */
export const StartDeleteAccountBodySchema = z.object({});
export type StartDeleteAccountBody = z.infer<
  typeof StartDeleteAccountBodySchema
>;

export const StartDeleteAccountResponseSchema = z.object({
  message: z.string(),
});
export type StartDeleteAccountResponse = z.infer<
  typeof StartDeleteAccountResponseSchema
>;
