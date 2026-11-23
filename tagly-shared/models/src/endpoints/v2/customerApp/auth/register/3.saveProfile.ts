import { z } from "zod";
import { GenderSchema } from "../../../../../core/enums";

/**
 * `POST /v2/public/auth/customers/save-profile` — persist profile data onto the
 * PendingCustomer (the "finish profile" step). No consent fields here: ToS +
 * Privacy are passive (stamped at creation) and promo has its own step.
 */
export const SaveProfileBodySchema = z.object({
  registrationToken: z.string().min(1),
  fullName: z.string().min(1),
  gender: GenderSchema,
  // Interest *slugs* from the @tagly/models catalog (the source of truth; the DB
  // is seeded from it). The backend resolves them to interest rows by unique slug.
  interestSlugs: z.array(z.string().min(1)).max(3),
});
export type SaveProfileBody = z.infer<typeof SaveProfileBodySchema>;

/** Response */
export const SaveProfileResponseSchema = z.object({
  message: z.string(),
});
export type SaveProfileResponse = z.infer<typeof SaveProfileResponseSchema>;
