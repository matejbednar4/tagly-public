import { z } from "zod";
import { AdminBlastSchema } from "../../../../dtos/v2/adminApp/notifications/adminBlast";

/**
 * GET /v2/admin/notifications/blasts — recent blasts (newest first) with live
 * queue delivery stats. Push opens live in PostHog (`push_opened` events whose
 * slug is `admin.blast:<blast slug>`); email deliverability lives in
 * the Resend dashboard filtered by the `blast` tag.
 */
export const AdminGetBlastsResponseSchema = z.object({
  message: z.string(),
  blasts: z.array(AdminBlastSchema),
});
export type AdminGetBlastsResponse = z.infer<
  typeof AdminGetBlastsResponseSchema
>;
