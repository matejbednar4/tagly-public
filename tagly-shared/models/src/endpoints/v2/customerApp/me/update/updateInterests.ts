import { z } from "zod";
import { ISODateSchema } from "../../../../../core/time";
import { InterestInListSchema } from "../../../../../dtos/v2/crossApp/common/interest";

/**
 * `POST /v2/customers/me/update/interests` — replace the logged-in customer's
 * follower interests (up to 3). Clean v2 wire: interest **slugs** (the catalog's
 * source of truth), never integer IDs. Setting a non-empty set is gated by a
 * 60-day cooldown; clearing to an empty set bypasses it and resets the timestamp.
 */
export const UpdateInterestsBodySchema = z.object({
  interestSlugs: z.array(z.string().min(1)).max(3),
});
export type UpdateInterestsBody = z.infer<typeof UpdateInterestsBodySchema>;

export const UpdateInterestsResponseSchema = z.object({
  interests: z.array(InterestInListSchema).max(3),
  /** When interests were last changed (gates the cooldown), or null after a clear. */
  interestsUpdatedAt: ISODateSchema.nullable(),
});
export type UpdateInterestsResponse = z.infer<
  typeof UpdateInterestsResponseSchema
>;
