import type { PaygPeriodEndReason } from "@tagly/models/shared";
import type { PaygStatus } from "@tagly/models/v2/advertiserApp";

/**
 * The single derivation of the wire `PaygStatus` — used by both
 * `GET /v2/advertisers/me` (budgets) and `GET /v2/advertisers/me/billing/payg`,
 * so clients never re-implement the PAYG rules:
 *
 * - no card                                   → NOT_LINKED
 * - card, open period                         → ACTIVE
 * - card, no open period, last period closed
 *   on CHARGE_FAILED                          → CARD_FAILED ("update your card")
 * - card, no open period, closed for any
 *   other reason (DISABLED — PAYG turned off
 *   while keeping the shared card; or never
 *   opened, e.g. the card was linked for the
 *   monthly budget)                            → NOT_LINKED
 *
 * Before the saved card was shared with the monthly budget, "card + no open
 * period" could only mean a failed charge (removal always cleared the card);
 * now the end reason is what separates "paused on a decline" from "off".
 * `NOT_LINKED` for a linked-but-off card is deliberate: the shipped wire has
 * only these three values, and for the PAYG surface "off, relink/turn on to
 * resume" renders the same either way.
 *
 * PAYG has no spend cap: an open period + card is simply ACTIVE (the card funds
 * every share; the advertiser stops by turning it off or unlinking the card).
 */
export function derivePaygStatus({
  cardOnFile,
  periodOpen,
  lastEndedReason,
}: {
  cardOnFile: boolean;
  periodOpen: boolean;
  lastEndedReason: PaygPeriodEndReason | null;
}): PaygStatus {
  if (!cardOnFile) return "NOT_LINKED";
  if (periodOpen) return "ACTIVE";
  if (lastEndedReason === "CHARGE_FAILED") return "CARD_FAILED";
  return "NOT_LINKED";
}
