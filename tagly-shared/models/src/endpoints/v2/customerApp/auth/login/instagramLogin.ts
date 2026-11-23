import { z } from "zod";

/**
 * `POST /v2/public/auth/customers/instagram-login` — log in via Instagram for
 * users who connected it but can't recall their email. Exchanges the IG OAuth
 * `code`, finds the Customer by their linked Instagram identity, returns a JWT.
 */
export const InstagramLoginBodySchema = z.object({
  code: z.string().min(1),
});
export type InstagramLoginBody = z.infer<typeof InstagramLoginBodySchema>;

/** Response */
export const InstagramLoginResponseSchema = z.object({
  jwt: z.string(),
});
export type InstagramLoginResponse = z.infer<
  typeof InstagramLoginResponseSchema
>;
