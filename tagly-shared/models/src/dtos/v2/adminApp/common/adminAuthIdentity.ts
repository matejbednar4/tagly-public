import { z } from "zod";
import { OAuthProviderSchema } from "../../../../core/enums";
import { ISODateSchema } from "../../../../core/time";

/**
 * One linked OAuth sign-in identity (Apple / Google). Email-OTP sign-in has no
 * identity row — an empty list means the account signs in by email code (or,
 * for admin, password) only. `email` is the address at link time (Apple's
 * private relay possible), which may differ from the account email.
 */
export const AdminAuthIdentitySchema = z.object({
  provider: OAuthProviderSchema,
  email: z.string().nullable(),
  linkedAt: ISODateSchema,
});
export type AdminAuthIdentity = z.infer<typeof AdminAuthIdentitySchema>;
