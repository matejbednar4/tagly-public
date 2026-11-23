import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";
import { ShareUidSchema } from "../../../../core/uids";
import { WithdrawalDisplayStateSchema } from "../../../../core/enums";
import { MediaPreviewSchema } from "../../crossApp/common/media";

/**
 * One row in the customer's money history. A discriminated union of the only two
 * customer-facing movements (the raw ledger's `*_LOCK`/`*_UNLOCK` plumbing and all
 * advertiser/platform-side kinds are never surfaced):
 *  - `earning` — money INTO the Tagly balance: a share reward (`SHARE_PAYMENT`,
 *    carrying the business), a referral bonus (`REFERRAL_PAYOUT`), or an admin
 *    balance adjustment (`ADJUSTMENT`). `amountCents` is signed (+; an adjustment
 *    may be −).
 *  - `withdrawal` — money OUT to the bank: one item per `StripeWithdrawal`, with
 *    its derived `WithdrawalDisplayState` (never the raw, overloaded status).
 *    `amountCents` is the positive magnitude (the client renders it as −/out).
 *
 * `key` is an opaque stable id for list keying (`e:<ledgerEventId>` /
 * `w:<withdrawalUid>`) — ledger events have no uid of their own.
 */
export const CustomerTransactionEarningSourceSchema = z.enum([
  "SHARE_PAYMENT",
  "REFERRAL_PAYOUT",
  "ADJUSTMENT",
]);
export type CustomerTransactionEarningSource = z.infer<
  typeof CustomerTransactionEarningSourceSchema
>;

export const CustomerTransactionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("earning"),
    key: z.string(),
    source: CustomerTransactionEarningSourceSchema,
    amountCents: CentsSchema,
    /** The business for a share reward; null for referral / adjustment. */
    businessName: z.string().nullable(),
    /** The business's banner (share reward with one on file); null otherwise. */
    businessBanner: MediaPreviewSchema.nullable(),
    /** The underlying share for a share reward (deep link); null otherwise. */
    shareUid: ShareUidSchema.nullable(),
    createdAt: ISODateSchema,
  }),
  z.object({
    type: z.literal("withdrawal"),
    key: z.string(),
    amountCents: CentsSchema,
    state: WithdrawalDisplayStateSchema,
    createdAt: ISODateSchema,
  }),
]);

export type CustomerTransaction = z.infer<typeof CustomerTransactionSchema>;
export type CustomerTransactionInput = z.input<typeof CustomerTransactionSchema>;
