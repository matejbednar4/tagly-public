import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";

/**
 * `POST /v2/admin/shares/:uid/reject` — intake-reject a PENDING share.
 * Sets `approvalStatus = REJECTED` (the payout `status` stays PROCESSING —
 * rejection is not a status in v2), penalizes the customer's multiplier, and
 * sends the mandatory push+email with the reason. The reason is required
 * because it is shown to the customer verbatim.
 */
export const AdminRejectShareParamsSchema = z.object({
  uid: ShareUidSchema,
});
export type AdminRejectShareParams = z.infer<typeof AdminRejectShareParamsSchema>;

export const AdminRejectShareBodySchema = z.object({
  /** Shown to the customer verbatim. The `min(1)` is load-bearing beyond UX:
   *  `CustomerShareDetails.rejectionReason` is null ⟺ report-upheld rejection,
   *  so the customer app infers "rejected by report" from REJECTED + null
   *  reason. An intake reject must therefore always carry a non-empty reason —
   *  never make this optional. */
  reason: z.string().min(1).max(1000),
});
export type AdminRejectShareBody = z.infer<typeof AdminRejectShareBodySchema>;

export const AdminRejectShareResponseSchema = z.object({
  message: z.string(),
});
export type AdminRejectShareResponse = z.infer<
  typeof AdminRejectShareResponseSchema
>;
