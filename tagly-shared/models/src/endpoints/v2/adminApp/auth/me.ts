import { z } from "zod";
import { EmailSchema } from "../../../../core/email";
import { AdminUidSchema } from "../../../../core/uids";
import { AdminRoleSchema } from "../../../../core/enums";

/**
 * `GET /v2/admin/me` — the authenticated admin's profile. Used by the app to
 * display the current user and validate the session on launch. Requires a valid
 * admin-capability JWT (checked by middleware).
 */
export const AdminGetMeResponseSchema = z.object({
  uid: AdminUidSchema,
  email: EmailSchema,
  username: z.string(),
  role: AdminRoleSchema,
});
export type AdminGetMeResponse = z.infer<typeof AdminGetMeResponseSchema>;
