import { z } from "zod";
import {
  PaginationReqBase,
  PaginationResBase,
} from "../../../../core/pagination";
import { CustomerTransactionSchema } from "../../../../dtos/v2/customerApp/transactions/transaction";

/**
 * `POST /v2/customers/transactions` — the customer's money history (earnings in +
 * withdrawals out), newest first, offset-paginated. POST + body so it plugs into
 * the codebase's paginated-list convention (`makeOffsetFetcher`/`PaginatedList`).
 *
 * `types` is an optional multi-select filter; omitted or empty means "all". The
 * values are the four customer-facing transaction types — the three earning
 * ledger kinds plus withdrawals.
 */
export const CustomerTransactionTypeFilterSchema = z.enum([
  "SHARE_PAYMENT",
  "REFERRAL_PAYOUT",
  "ADJUSTMENT",
  "WITHDRAWAL",
]);
export type CustomerTransactionTypeFilter = z.infer<
  typeof CustomerTransactionTypeFilterSchema
>;

export const GetCustomerTransactionsBodySchema = PaginationReqBase.extend({
  types: z.array(CustomerTransactionTypeFilterSchema).optional(),
});
export type GetCustomerTransactionsBody = z.infer<
  typeof GetCustomerTransactionsBodySchema
>;

export const GetCustomerTransactionsResponseSchema = PaginationResBase.extend({
  message: z.string(),
  transactions: z.array(CustomerTransactionSchema),
});
export type GetCustomerTransactionsResponse = z.infer<
  typeof GetCustomerTransactionsResponseSchema
>;
