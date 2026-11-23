import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";
import { AdminShareSchema } from "../../../../dtos/v2/adminApp/shares/adminShare";

/** `GET /v2/admin/shares/:uid` — one share, full admin view. */
export const AdminShareUidParamsSchema = z.object({
  uid: ShareUidSchema,
});
export type AdminShareUidParams = z.infer<typeof AdminShareUidParamsSchema>;

export const AdminGetShareResponseSchema = z.object({
  message: z.string(),
  share: AdminShareSchema,
});
export type AdminGetShareResponse = z.infer<typeof AdminGetShareResponseSchema>;
