import { z } from "zod";
import { AdminShareSchema } from "../../../../dtos/v2/adminApp/shares/adminShare";

/**
 * `GET /v2/admin/shares/pending-report` — the report-review queue: shares whose
 * `ShareReport` is PENDING (the payout is held until an admin issues a verdict
 * via `PUT /v2/admin/shares/:uid/report-review`). Oldest report first; a fixed
 * page of the oldest plus the full outstanding `total`.
 */
export const AdminSharesPendingReportResponseSchema = z.object({
  message: z.string(),
  shares: z.array(AdminShareSchema),
  total: z.number().int().min(0),
});
export type AdminSharesPendingReportResponse = z.infer<
  typeof AdminSharesPendingReportResponseSchema
>;
