import { z } from "zod";

/**
 * `POST /v2/customers/me/security/sign-out-others` — revoke every other session
 * (bumps the customer's token version) and re-issue THIS device a fresh token.
 * No request body. The client must persist the returned `token` (it replaces the
 * now-invalid one) so the current device stays signed in.
 */
export const SignOutOtherSessionsResponseSchema = z.object({
  /** A fresh session JWT for the current device, carrying the new token version. */
  token: z.string(),
});
export type SignOutOtherSessionsResponse = z.infer<
  typeof SignOutOtherSessionsResponseSchema
>;
