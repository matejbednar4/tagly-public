import { z } from "zod";
import { AdvertiserUidSchema } from "../../../../core/uids";
import { CentsSchema } from "../../../../core/money";
import { PROMOTIONAL_CREDITS } from "../../../../constants/billing/PROMOTIONAL_CREDITS";

/**
 * `POST /v2/admin/advertisers/:uid/promotional-credit` — gift an advertiser
 * promotional credits from the platform's unassigned Stripe balance (zero-sum
 * PROMOTIONAL_CREDIT ledger event, platform → advertiser). Capped at
 * `PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS` per request and idempotent per
 * advertiser per hour. Params reuse `AdminAdvertiserUidParamsSchema`.
 */
export const AdminAssignPromotionalCreditBodySchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(1, "Amount must be at least 1 cent")
    .max(
      PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS,
      `Amount cannot exceed ${PROMOTIONAL_CREDITS.MAX_AMOUNT_CENTS} cents`,
    ),
  reason: z.string().max(500).optional(),
});
export type AdminAssignPromotionalCreditBody = z.infer<
  typeof AdminAssignPromotionalCreditBodySchema
>;

export const AdminAssignPromotionalCreditResponseSchema = z.object({
  message: z.string(),
  eventId: z.number(),
  advertiserUid: AdvertiserUidSchema,
  amountCents: CentsSchema,
  newAvailableBudgetCents: CentsSchema,
});
export type AdminAssignPromotionalCreditResponse = z.infer<
  typeof AdminAssignPromotionalCreditResponseSchema
>;
