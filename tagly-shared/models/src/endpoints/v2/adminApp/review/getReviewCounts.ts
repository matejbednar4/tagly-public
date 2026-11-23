import { z } from "zod";

/**
 * `GET /v2/admin/review/counts` — how many items sit in each moderation queue.
 * Powers the Review tab hub (each queue button shows its count and highlights
 * when > 0). Counts use the exact same filters as the matching list endpoints
 * so the number always matches what the queue screen shows.
 */
export const AdminReviewCountsResponseSchema = z.object({
  message: z.string(),
  counts: z.object({
    /** Shares awaiting intake approval (PENDING + still PROCESSING). */
    pendingApproval: z.number().int().min(0),
    /** Advertiser/admin reports awaiting a verdict. */
    pendingReports: z.number().int().min(0),
    /** APPROVED subsidized shares never rated or reported. */
    unratedSubsidized: z.number().int().min(0),
    /** Business links awaiting review (hidden from customers until approved). */
    pendingLinks: z.number().int().min(0),
  }),
});
export type AdminReviewCountsResponse = z.infer<
  typeof AdminReviewCountsResponseSchema
>;
