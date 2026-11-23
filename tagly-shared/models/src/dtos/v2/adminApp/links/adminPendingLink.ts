import { z } from "zod";
import { ISODateSchema } from "../../../../core/time";
import { LocalSubaccountUidSchema } from "../../../../core/uids";

/**
 * One slot a business can reference a link from. A single Link row is shared
 * (de-duplicated by url) across businesses and slots, so a queue entry lists
 * every (business, slot) pair that will go live when the link is approved.
 */
export const AdminLinkSlotSchema = z.enum(["website", "reservation", "menu"]);
export type AdminLinkSlot = z.infer<typeof AdminLinkSlotSchema>;

export const AdminPendingLinkBusinessSchema = z.object({
  uid: LocalSubaccountUidSchema,
  name: z.string(),
  slots: z.array(AdminLinkSlotSchema).min(1),
});
export type AdminPendingLinkBusiness = z.infer<
  typeof AdminPendingLinkBusinessSchema
>;

/**
 * A PENDING `Link` row awaiting admin review. Links have no uid — the numeric
 * DB id is the wire identifier (admin-only surface, ships in lockstep).
 * `businesses` is every business currently referencing the URL (possibly empty
 * if the referencing page was deleted after submission).
 */
export const AdminPendingLinkSchema = z.object({
  id: z.number().int(),
  url: z.string(),
  createdAt: ISODateSchema,
  businesses: z.array(AdminPendingLinkBusinessSchema),
});
export type AdminPendingLink = z.infer<typeof AdminPendingLinkSchema>;
export type AdminPendingLinkInput = z.input<typeof AdminPendingLinkSchema>;
