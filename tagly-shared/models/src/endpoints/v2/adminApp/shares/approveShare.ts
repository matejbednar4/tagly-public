import { z } from "zod";
import { ShareUidSchema } from "../../../../core/uids";

/**
 * `POST /v2/admin/shares/:uid/approve` — intake-approve a PENDING share.
 * Atomically flips PENDING → APPROVED (guarded on `status = PROCESSING`) and
 * places the deferred budget lock by `fundingModeAtCreation` (CREDITS →
 * advertiser budget capped at available; SUBSIDIZED → platform pool; PAYG →
 * lock-less), then notifies the advertiser. No body — approval has no inputs.
 */
export const AdminApproveShareParamsSchema = z.object({
  uid: ShareUidSchema,
});
export type AdminApproveShareParams = z.infer<
  typeof AdminApproveShareParamsSchema
>;

export const AdminApproveShareResponseSchema = z.object({
  message: z.string(),
});
export type AdminApproveShareResponse = z.infer<
  typeof AdminApproveShareResponseSchema
>;
