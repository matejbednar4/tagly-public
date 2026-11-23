import { z } from "zod";

/**
 * `POST /v2/public/auth/customers/complete-registration` — promote the
 * PendingCustomer to a Customer (the final onboarding step). Returns a session
 * JWT (HTTP 201).
 *
 * Instagram is optional: provide `code` to exchange + link the IG account to the
 * new Customer. If that IG already belongs to another Customer, the request is
 * **rejected** with 2214 (connecting an IG is never an implicit login into
 * someone else's account — the client offers the dedicated `instagram-login`
 * recovery instead). Omit `code` to finish without IG — monetization is gated
 * in-app until the user connects it later.
 */
export const CompleteRegistrationBodySchema = z.object({
  /** Instagram OAuth code. Omit to complete without linking Instagram. */
  code: z.string().min(1).optional(),
  registrationToken: z.string().min(1),
});
export type CompleteRegistrationBody = z.infer<
  typeof CompleteRegistrationBodySchema
>;

/**
 * `{ jwt }` for the freshly-created Customer (HTTP 201). An IG that already
 * belongs to another Customer is a 2214 rejection, not a login — so this
 * response only ever represents a brand-new account.
 */
export const CompleteRegistrationResponseSchema = z.object({
  jwt: z.string(),
});
export type CompleteRegistrationResponse = z.infer<
  typeof CompleteRegistrationResponseSchema
>;
