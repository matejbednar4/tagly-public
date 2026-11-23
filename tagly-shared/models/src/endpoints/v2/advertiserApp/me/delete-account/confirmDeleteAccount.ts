import { z } from "zod";

/**
 * `POST /v2/advertisers/me/delete-account/confirm` — verify the `ACCOUNT_DELETION`
 * OTP, forfeit any remaining credit balance to the platform, mark unpaid shares
 * UNPAYABLE, and hard-delete the account. Requires a prior `start`. OTP errors
 * surface via the shared OTP error codes; the "owes money" guard (negative
 * balance) is a domain error handled by the client.
 */
export const ConfirmDeleteAccountBodySchema = z.object({
  otp: z.string().length(6),
});
export type ConfirmDeleteAccountBody = z.infer<
  typeof ConfirmDeleteAccountBodySchema
>;

export const ConfirmDeleteAccountResponseSchema = z.object({
  message: z.string(),
});
export type ConfirmDeleteAccountResponse = z.infer<
  typeof ConfirmDeleteAccountResponseSchema
>;
