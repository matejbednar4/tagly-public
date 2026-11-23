import { z } from "zod";
import { WithdrawalUidSchema } from "../../../../../core/uids";
import { CustomerWithdrawalSchema } from "../../../../../dtos/v2/customerApp/billing/withdrawal";

export const GetWithdrawalStatusQuerySchema = z.object({
  withdrawalUid: WithdrawalUidSchema,
});
export type GetWithdrawalStatusQuery = z.infer<
  typeof GetWithdrawalStatusQuerySchema
>;

// The single-withdrawal poll: the customer's "did my cash-out work?" check,
// returning the same display-state shape as the money feed.
export const GetWithdrawalStatusResponseSchema = z.object({
  withdrawal: CustomerWithdrawalSchema,
});
export type GetWithdrawalStatusResponse = z.infer<
  typeof GetWithdrawalStatusResponseSchema
>;
