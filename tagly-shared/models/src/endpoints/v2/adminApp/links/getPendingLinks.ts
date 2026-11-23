import { z } from "zod";
import { AdminPendingLinkSchema } from "../../../../dtos/v2/adminApp/links/adminPendingLink";

/**
 * `GET /v2/admin/links/pending` — business links awaiting review. A link stays
 * hidden from customers until an admin approves it (only APPROVED urls are
 * returned by the customer hydrators), so this queue is what actually puts
 * submitted website/reservation/menu links live. Oldest first; a fixed page of
 * the oldest plus the full outstanding `total`.
 */
export const AdminPendingLinksResponseSchema = z.object({
  message: z.string(),
  links: z.array(AdminPendingLinkSchema),
  total: z.number().int().min(0),
});
export type AdminPendingLinksResponse = z.infer<
  typeof AdminPendingLinksResponseSchema
>;
