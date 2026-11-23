import { z } from "zod";
import { AdminLedgerEventSchema } from "../../../../dtos/v2/adminApp/shares/adminLedgerEvent";

/**
 * `GET /v2/admin/ledger-events/from/:uid` — the entity-wide, chronological money
 * trail for one account (customer / advertiser / business, resolved from the uid
 * prefix; a business resolves to its advertiser's ledger). Paginated, newest
 * first. Broader than the per-purchase / per-withdrawal trails embedded in the
 * detail screens: this is every `TransactionLedgerEvent` the account touched
 * (locks, settles, referral payouts, PAYG charges, …). Powers the
 * `transactions/from/[uid]` screen reached from each entity detail.
 */
export const AdminLedgerEventsFromUidParamsSchema = z.object({
  // Any of a customer / advertiser / local-subaccount uid; the controller
  // resolves the parent type from the prefix.
  uid: z.string(),
});
export type AdminLedgerEventsFromUidParams = z.infer<
  typeof AdminLedgerEventsFromUidParamsSchema
>;

export const AdminLedgerSortSchema = z.enum(["newest", "oldest"]);
export type AdminLedgerSort = z.infer<typeof AdminLedgerSortSchema>;

export const AdminLedgerEventsFromUidQuerySchema = z.object({
  sort: AdminLedgerSortSchema.default("newest"),
  page: z.coerce.number().int().positive().default(1),
});
export type AdminLedgerEventsFromUidQuery = z.infer<
  typeof AdminLedgerEventsFromUidQuerySchema
>;

export const AdminLedgerEventsFromUidResponseSchema = z.object({
  message: z.string(),
  events: z.array(AdminLedgerEventSchema),
  total: z.number(),
  page: z.number(),
  hasMore: z.boolean(),
});
export type AdminLedgerEventsFromUidResponse = z.infer<
  typeof AdminLedgerEventsFromUidResponseSchema
>;
