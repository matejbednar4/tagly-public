import { z } from "zod";

/**
 * Server-derived pay-as-you-go status — the single wire value clients render
 * PAYG state from, so the underlying rules (the card/period invariants) live
 * only in the backend (`utils/hydrators/billing/derivePaygStatus.ts`) and can't drift
 * across surfaces.
 *
 * - `NOT_LINKED`     no PAYG card on file.
 * - `ACTIVE`         card + open period. PAYG has no spend cap — the card funds
 *                    every share and the advertiser stops by unlinking it.
 * - `CARD_FAILED`    card on file but the period is closed: a settlement
 *                    charge failed (removal always clears the card, so this is
 *                    the only way to be here). Prompt "update your card".
 */
export const PaygStatusValues = [
  "NOT_LINKED",
  "ACTIVE",
  "CARD_FAILED",
] as const;
export const PaygStatusSchema = z.enum(PaygStatusValues);
export type PaygStatus = z.infer<typeof PaygStatusSchema>;
