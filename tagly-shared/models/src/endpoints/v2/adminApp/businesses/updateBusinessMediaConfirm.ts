import { z } from "zod";
import { UpdateBusinessMediaConfirmBodySchema } from "../../advertiserApp/businesses/updateBusinessMediaConfirm";
import { AdminBusinessSchema } from "../../../../dtos/v2/adminApp/businesses/adminBusiness";

/**
 * `POST /v2/admin/businesses/:uid/media/confirm` — phase 2 of an ADMIN
 * editing a business page's banner/photos. `keepPhotoUids` is the
 * authoritative keep list; a pure removal calls confirm directly.
 *
 * Deliberate wire-twin: the body ALIASES the advertiser schema — same
 * `updateBusinessMediaConfirmCore` behind both. The response is the full
 * `AdminBusiness`, not the advertiser's owner details.
 */
export const AdminUpdateBusinessMediaConfirmBodySchema =
  UpdateBusinessMediaConfirmBodySchema;
export type AdminUpdateBusinessMediaConfirmBody = z.infer<
  typeof AdminUpdateBusinessMediaConfirmBodySchema
>;

export const AdminUpdateBusinessMediaConfirmResponseSchema = z.object({
  message: z.string(),
  business: AdminBusinessSchema,
});
export type AdminUpdateBusinessMediaConfirmResponse = z.infer<
  typeof AdminUpdateBusinessMediaConfirmResponseSchema
>;
