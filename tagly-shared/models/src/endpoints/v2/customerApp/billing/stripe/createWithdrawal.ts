import { z } from "zod";
import { WITHDRAWALS } from "../../../../../constants/billing/DEPOSITS_WITHDRAWALS";
import { CustomerWithdrawalSchema } from "../../../../../dtos/v2/customerApp/billing/withdrawal";

export const CreateWithdrawalBodySchema = z.object({
  amountCents: z
    .number()
    .min(WITHDRAWALS.MIN_AMOUNT_CENTS)
    .max(WITHDRAWALS.MAX_AMOUNT_CENTS),
});
export type CreateWithdrawalBody = z.infer<typeof CreateWithdrawalBodySchema>;

// Kept as an object wrapper so more fields (e.g. an updated balance) can be
// added later without a breaking retype of the top-level response.
export const CreateWithdrawalResponseSchema = z.object({
  withdrawal: CustomerWithdrawalSchema,
});
export type CreateWithdrawalResponse = z.infer<
  typeof CreateWithdrawalResponseSchema
>;
