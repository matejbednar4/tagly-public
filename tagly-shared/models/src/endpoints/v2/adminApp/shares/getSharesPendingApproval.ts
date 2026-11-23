import { z } from "zod";
import { AdminShareSchema } from "../../../../dtos/v2/adminApp/shares/adminShare";

/**
 * `GET /v2/admin/shares/pending-approval` — the intake moderation queue: shares
 * with `approvalStatus = PENDING` that are still `status = PROCESSING` (a share
 * voided to UNPAYABLE while pending must not be approvable — the lock would be
 * unreleasable) and have a customer. Oldest first; a fixed page of the oldest
 * plus the full outstanding `total`.
 */
export const AdminSharesPendingApprovalResponseSchema = z.object({
  message: z.string(),
  shares: z.array(AdminShareSchema),
  total: z.number().int().min(0),
});
export type AdminSharesPendingApprovalResponse = z.infer<
  typeof AdminSharesPendingApprovalResponseSchema
>;
