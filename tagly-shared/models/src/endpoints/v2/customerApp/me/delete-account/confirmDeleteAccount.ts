import { z } from "zod";

/**
 * `POST /v2/customers/me/delete-account/confirm` — verify the `ACCOUNT_DELETION`
 * OTP, resolve any remaining balance (sweep it to the customer's Stripe Connect
 * account, or forfeit it with explicit consent), and hard-delete the account.
 * Requires a prior `start`. OTP errors surface via the shared OTP error codes;
 * domain errors (funds locked / balance not yet withdrawn / sweep in flight) are
 * handled by the client.
 */
export const ConfirmDeleteAccountBodySchema = z.object({
  otp: z.string().length(6),
  /**
   * Explicit consent to forfeit any remaining balance instead of sweeping it.
   * When `true`, the backend skips the withdraw-first requirement (1201) and the
   * sweep, records the forfeit as a ledger event, and deletes the account —
   * so deletion never requires Stripe Connect onboarding (App Review 5.1.1(v)).
   * Optional and additive: old clients never send it and behave as before.
   */
  forfeitConsent: z.boolean().optional(),
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
