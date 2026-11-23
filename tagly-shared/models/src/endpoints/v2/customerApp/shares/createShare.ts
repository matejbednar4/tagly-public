import { z } from "zod";
import { LocalSubaccountUidSchema } from "../../../../core/uids";
import { CustomerSharePreviewSchema } from "../../../../dtos/v2/customerApp/shares/customerSharePreview";

/**
 * `POST /v2/customers/shares/create` — create a share for a business from one of the
 * customer's live Instagram stories. The customer must have explicitly agreed to
 * the Terms of Monetization (`agreedToTermsOfMonetization` is a hard `true`).
 * Returns the newly created share in its lean preview shape.
 */
export const CreateShareBodySchema = z.object({
  businessUid: LocalSubaccountUidSchema,
  storyId: z.string().min(1),
  agreedToTermsOfMonetization: z.literal(true),
});
export type CreateShareBody = z.infer<typeof CreateShareBodySchema>;

export const CreateShareResponseSchema = z.object({
  message: z.string(),
  share: CustomerSharePreviewSchema,
});
export type CreateShareResponse = z.infer<typeof CreateShareResponseSchema>;
