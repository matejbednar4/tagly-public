import { VISIBILITY_BUDGETS } from "@tagly/models/shared";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";

/** Why the advertiser is not visible right now — the key picks the cause prose
 *  inside the `VisibilitySheet` (`<cause>Body` in the visibilitySheet
 *  namespace). */
export type VisibilityCause =
  | "noPage"
  | "activate"
  | "lapsedNegative"
  | "lapsedCardIssue"
  | "lapsedLowCredits"
  | "lapsed";

/**
 * Derive the single most specific/actionable reason the advertiser is not
 * visible, from the server facts on `AdvertiserMe` (`visible`, `funded`,
 * `hasBusinessPage`, `budgets`). Returns `null` while visible — and on a failed
 * /me (advertiser null), fail-open: no false alarm.
 *
 * Priority: no business page (visibility is impossible without one, whatever
 * the funding state) → never funded → unpaid PAYG debt (negative balance) →
 * broken card → credits under the visibility minimum → generic ran-out.
 * The trivial threshold comparisons are the only client-side numerics; all
 * real funding rules stay server-derived (`budgets.paygStatus`, `visible`).
 */
export function useVisibilityCause(): VisibilityCause | null {
  const { advertiser } = useAdvertiser();
  if (!advertiser || advertiser.visible) return null;

  const availableCents = advertiser.budgets?.availableCents ?? 0;
  const paygStatus = advertiser.budgets?.paygStatus ?? "NOT_LINKED";

  if (!advertiser.hasBusinessPage) return "noPage";
  if (!advertiser.funded) return "activate";
  if (availableCents < 0) return "lapsedNegative";
  if (paygStatus === "CARD_FAILED") return "lapsedCardIssue";
  if (
    availableCents > 0 &&
    availableCents < VISIBILITY_BUDGETS.MIN_VISIBILITY_BUDGET_CENTS
  )
    return "lapsedLowCredits";
  return "lapsed";
}
