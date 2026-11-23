import { z } from "zod";
import { PaygPeriodEndReasonSchema } from "../../../../../core/enums";
import { PaygStatusSchema } from "../../../../../dtos/v2/advertiserApp/billing/paygStatus";
import {
  SavedCardSchema,
  type SavedCard,
} from "../../../../../dtos/v2/advertiserApp/billing/savedCard";

/**
 * `GET /v2/advertisers/me/billing/payg` — the pay-as-you-go state backing the
 * PaygSheet's manage view: is a period open, why the last one closed, and
 * whether a saved card is on file. Fetched on sheet open (not embedded on
 * `AdvertiserMe`, which stays lean and only carries the `paygActive` boolean).
 * The card itself is `GET /billing/payment-method`.
 */

/**
 * The linked card, fetched live from Stripe (never stored). The shipped name
 * for the account's one saved off-session card (`SavedCardSchema`) — the same
 * card the monthly budget charges.
 */
export const PaygCardSchema = SavedCardSchema;
export type PaygCard = SavedCard;

// No request body — the advertiser is taken from the JWT.

export const GetPaygStateResponseSchema = z.object({
  /**
   * A saved off-session card is on file (chargeable off-session). The account
   * has ONE such card, shared with the monthly budget — a card linked for
   * either feature shows here.
   */
  hasCard: z.boolean(),
  /**
   * @deprecated Back-compat only — always `null`. The card's details moved to
   * `GET /billing/payment-method` (the saved card is shared with the monthly
   * budget; PAYG state is only "is a period open"). Builds shipped before
   * 2026-09 render their generic "Card linked" label on `null`. Stop returning
   * once those builds roll off.
   */
  card: PaygCardSchema.nullable(),
  /** An open PaygPeriod exists — PAYG is currently on. */
  active: z.boolean(),
  /**
   * Server-derived PAYG state — the manage sheet renders its status pill and
   * notes from this (same derivation as `AdvertiserBudgets.paygStatus`).
   */
  status: PaygStatusSchema,
  /**
   * Why the most recent period closed (null when none ever closed). With a
   * card on file and `active: false`, `CHARGE_FAILED` means the card is
   * declining — prompt the advertiser to update it.
   */
  lastEndedReason: PaygPeriodEndReasonSchema.nullable(),
});
export type GetPaygStateResponse = z.infer<typeof GetPaygStateResponseSchema>;
