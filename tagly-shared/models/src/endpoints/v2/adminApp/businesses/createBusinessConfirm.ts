import { z } from "zod";
import { CreateBusinessConfirmBodySchema } from "../../advertiserApp/businesses/createBusinessConfirm";
import {
  AdminBusinessSchema,
  AdminBusinessTagsSchema,
} from "../../../../dtos/v2/adminApp/businesses/adminBusiness";

/**
 * `POST /v2/admin/businesses/confirm` — phase 2 of an ADMIN creating a
 * business page (unowned; see the init schema for the ownership semantics).
 *
 * Deliberate wire-twin: the body EXTENDS the advertiser confirm body — same
 * `createBusinessConfirmCore` behind both — with the one admin-only field:
 * `tags` (search aliases; advertisers can never set them). The response is
 * the full `AdminBusiness` (the admin surface's one business DTO), not the
 * advertiser's owner preview.
 */
export const AdminCreateBusinessConfirmBodySchema =
  CreateBusinessConfirmBodySchema.extend({
    /** Search aliases (admin-only). Omitted ⇒ created with none. */
    tags: AdminBusinessTagsSchema.optional(),
  });
export type AdminCreateBusinessConfirmBody = z.infer<
  typeof AdminCreateBusinessConfirmBodySchema
>;

export const AdminCreateBusinessConfirmResponseSchema = z.object({
  message: z.string(),
  business: AdminBusinessSchema,
});
export type AdminCreateBusinessConfirmResponse = z.infer<
  typeof AdminCreateBusinessConfirmResponseSchema
>;
