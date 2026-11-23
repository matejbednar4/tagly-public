import { z } from "zod";
import {
  UpdateBusinessMediaInitBodySchema,
  UpdateBusinessMediaInitResponseSchema,
} from "../../advertiserApp/businesses/updateBusinessMediaInit";

/**
 * `POST /v2/admin/businesses/:uid/media/init` — phase 1 of an ADMIN editing a
 * business page's banner/photos (any non-DELETED page, owned or unowned).
 *
 * Deliberate wire-twin: body/response ALIAS the advertiser schemas — same
 * `updateBusinessMediaInitCore` behind both (keep-by-uid semantics; pure
 * removals skip init and call confirm directly).
 */
export const AdminUpdateBusinessMediaInitBodySchema =
  UpdateBusinessMediaInitBodySchema;
export type AdminUpdateBusinessMediaInitBody = z.infer<
  typeof AdminUpdateBusinessMediaInitBodySchema
>;

export const AdminUpdateBusinessMediaInitResponseSchema =
  UpdateBusinessMediaInitResponseSchema;
export type AdminUpdateBusinessMediaInitResponse = z.infer<
  typeof AdminUpdateBusinessMediaInitResponseSchema
>;
