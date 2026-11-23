import { z } from "zod";
import { GenderSchema } from "../../../../../core/enums";
import { ISODateSchema } from "../../../../../core/time";

/**
 * `POST /v2/customers/me/update/gender` — update the logged-in customer's gender.
 * Setting a concrete value (`MALE`/`FEMALE`) is gated by a 90-day cooldown;
 * clearing to `UNSPECIFIED` bypasses the cooldown and resets the timestamp.
 */
export const UpdateGenderBodySchema = z.object({
  gender: GenderSchema,
});
export type UpdateGenderBody = z.infer<typeof UpdateGenderBodySchema>;

export const UpdateGenderResponseSchema = z.object({
  gender: GenderSchema,
  /** When gender was last changed (gates the cooldown), or null after a clear. */
  genderUpdatedAt: ISODateSchema.nullable(),
});
export type UpdateGenderResponse = z.infer<typeof UpdateGenderResponseSchema>;
