import { z } from "zod";
import {
  PaginationReqBase,
  PaginationResBase,
} from "../../../../core/pagination";
import { AdvertiserTransactionSchema } from "../../../../dtos/v2/advertiserApp/billing/advertiserTransaction";

/**
 * `POST /v2/advertisers/transactions` — the advertiser's money history (card
 * deposits in, share spend out, refunds/promo/adjustments/referral payouts),
 * newest first, offset-paginated. POST + body so it plugs into the codebase's
 * paginated-list convention (`makeOffsetFetcher`/`PaginatedList`). Twin of the
 * customer transactions feed.
 *
 * `types` is an optional multi-select filter; omitted or empty means "all".
 * `DEPOSIT` selects the card-charge rows, `SPEND` the settlement debits, and
 * the remaining values the individual `credit` sources.
 */
export const AdvertiserTransactionTypeFilterSchema = z.enum([
  "DEPOSIT",
  "SPEND",
  "CREDIT_PURCHASE_REFUND",
  "PROMOTIONAL_CREDIT",
  "ADJUSTMENT",
  "REFERRAL_PAYOUT",
]);
export type AdvertiserTransactionTypeFilter = z.infer<
  typeof AdvertiserTransactionTypeFilterSchema
>;

export const GetAdvertiserTransactionsBodySchema = PaginationReqBase.extend({
  types: z.array(AdvertiserTransactionTypeFilterSchema).optional(),
});
export type GetAdvertiserTransactionsBody = z.infer<
  typeof GetAdvertiserTransactionsBodySchema
>;

export const GetAdvertiserTransactionsResponseSchema = PaginationResBase.extend(
  {
    message: z.string(),
    transactions: z.array(AdvertiserTransactionSchema),
  },
);
export type GetAdvertiserTransactionsResponse = z.infer<
  typeof GetAdvertiserTransactionsResponseSchema
>;
