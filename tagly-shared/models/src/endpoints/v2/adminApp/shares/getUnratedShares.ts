import { z } from "zod";
import { AdminShareSchema } from "../../../../dtos/v2/adminApp/shares/adminShare";

/**
 * `GET /v2/admin/shares/unrated` — APPROVED subsidized shares never rated or
 * reported (`ratedAt IS NULL` — the canonical unassessed gate). Subsidized
 * businesses have no advertiser to rate their shares, so admins play that role
 * via `POST /v2/admin/shares/:uid/assess`. Oldest first; a fixed page of the
 * oldest plus the full outstanding `total`.
 */
export const AdminUnratedSharesResponseSchema = z.object({
  message: z.string(),
  shares: z.array(AdminShareSchema),
  total: z.number().int().min(0),
});
export type AdminUnratedSharesResponse = z.infer<
  typeof AdminUnratedSharesResponseSchema
>;
