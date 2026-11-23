import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";
import { ShareUidSchema } from "../../../../core/uids";
import {
  CreditPurchaseKindSchema,
  CreditPurchaseStatusSchema,
} from "../../../../core/enums";
import { MediaPreviewSchema } from "../../crossApp/common/media";

/**
 * One row in the advertiser's money history. A discriminated union of the three
 * advertiser-facing movements (the raw ledger's `SHARE_LOCK`/`SHARE_UNLOCK` and
 * refund-lock plumbing is never surfaced — the locked total already lives on the
 * balance card):
 *  - `deposit` — a card charge INTO the budget: one item per
 *    `StripeCreditPurchase` (a prepaid `CREDIT_PURCHASE` top-up or an
 *    off-session `PAYG_CHARGE` at share settlement), carrying its own
 *    `CreditPurchaseStatus` so pending/failed charges are visible — the twin of
 *    the customer feed's withdrawal rows. The ledger's `CREDIT_PURCHASE`/
 *    `PAYG_CHARGE` events are excluded from the feed since these rows already
 *    represent them. `amountCents` is the positive gross charged to the card.
 *  - `spend` — money OUT at share settlement: one item per `SHARE_PAYMENT`
 *    ledger event, with the share + business for deep-linking. `amountCents` is
 *    the positive magnitude of the advertiser debit (the client renders it as
 *    −/out).
 *  - `credit` — the remaining budget movements: a purchase refund
 *    (`CREDIT_PURCHASE_REFUND`, −), promotional credit, an admin adjustment
 *    (either sign), or a referral payout. `amountCents` is signed.
 *
 * `key` is an opaque stable id for list keying (`d:<purchaseUid>` /
 * `s:<ledgerEventId>` / `c:<ledgerEventId>`) — ledger events have no uid of
 * their own.
 */
export const AdvertiserTransactionCreditSourceSchema = z.enum([
  "CREDIT_PURCHASE_REFUND",
  "PROMOTIONAL_CREDIT",
  "ADJUSTMENT",
  "REFERRAL_PAYOUT",
]);
export type AdvertiserTransactionCreditSource = z.infer<
  typeof AdvertiserTransactionCreditSourceSchema
>;

export const AdvertiserTransactionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("deposit"),
    key: z.string(),
    /** Prepaid top-up vs off-session PAYG settlement charge. */
    kind: CreditPurchaseKindSchema,
    /** Gross charged to the card (for PAYG this includes the surcharge). */
    amountCents: CentsSchema,
    /** PAYG only: the fixed per-charge surcharge; null for prepaid top-ups. */
    paygSurchargeCents: CentsSchema.nullable(),
    status: CreditPurchaseStatusSchema,
    createdAt: ISODateSchema,
  }),
  z.object({
    type: z.literal("spend"),
    key: z.string(),
    /** Positive magnitude of the advertiser debit at settlement. */
    amountCents: CentsSchema,
    /** The business the settled share belongs to; null if it was deleted. */
    businessName: z.string().nullable(),
    /** The business's banner (thumbnail on the row, same as the customer feed); null when absent. */
    businessBanner: MediaPreviewSchema.nullable(),
    /** The underlying share (deep link); null if it no longer resolves. */
    shareUid: ShareUidSchema.nullable(),
    createdAt: ISODateSchema,
  }),
  z.object({
    type: z.literal("credit"),
    key: z.string(),
    source: AdvertiserTransactionCreditSourceSchema,
    /** Signed budget delta (a refund is −, promo/referral +, adjustment ±). */
    amountCents: CentsSchema,
    createdAt: ISODateSchema,
  }),
]);

export type AdvertiserTransaction = z.infer<typeof AdvertiserTransactionSchema>;
export type AdvertiserTransactionInput = z.input<
  typeof AdvertiserTransactionSchema
>;
