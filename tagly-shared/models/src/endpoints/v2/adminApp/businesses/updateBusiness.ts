import { z } from "zod";
import { UpdateBusinessBodySchema } from "../../advertiserApp/businesses/updateBusiness";
import {
  AdminBusinessSchema,
  AdminBusinessTagsSchema,
} from "../../../../dtos/v2/adminApp/businesses/adminBusiness";

/**
 * `PATCH /v2/admin/businesses/:uid` — edit ANY business page (owned or
 * unowned; ACTIVE or BANNED — only DELETED 404s). One PATCH covers data +
 * address (mirroring the advertiser PATCH). The advertiser-locale ↔ country invariant applies only when the
 * page HAS an advertiser; an unowned page may be moved between countries.
 *
 * Deliberate wire-twin: the body EXTENDS the advertiser update body — same
 * `updateBusinessCore` behind both, same field semantics (omitted =
 * unchanged, `null` = clear, `openingHours` = replace-all) — with the one
 * admin-only field: `tags` (present = replace the whole list; never
 * clearable to undefined — send `[]` to clear).
 */
export const AdminUpdateBusinessBodySchema = UpdateBusinessBodySchema.extend({
  /** Search aliases (admin-only). Present ⇒ replace-all; `[]` clears. */
  tags: AdminBusinessTagsSchema.optional(),
});
export type AdminUpdateBusinessBody = z.infer<
  typeof AdminUpdateBusinessBodySchema
>;

export const AdminUpdateBusinessResponseSchema = z.object({
  message: z.string(),
  business: AdminBusinessSchema,
});
export type AdminUpdateBusinessResponse = z.infer<
  typeof AdminUpdateBusinessResponseSchema
>;
