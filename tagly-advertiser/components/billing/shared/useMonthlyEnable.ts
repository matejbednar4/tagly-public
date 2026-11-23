import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { callAuthed } from "@tagly/client";
import { setMonthlyBudget } from "@tagly/sdk/v2/advertiserApp";
import { useCardLink } from "./useCardLink";
import { MONTHLY_BUDGET_STATE_QUERY_KEY } from "./useMonthlyBudgetState";

/**
 * Turning the monthly top-up on, or changing its amount.
 *
 * **Nothing here moves money.** Since 2026-09-03 activation never charges: the
 * `PUT` opens a period scheduled for the next 1st, and the stripe worker is the
 * only thing that ever runs one. So this hook has no run to wait for — it links
 * a card when there isn't one, sets the target, and returns. (It used to poll
 * `GET /monthly-budget` for ~45s against the worker's tick and report the run's
 * outcome; all of that is gone, along with the declined / retrying / paused /
 * unverified states it produced.)
 *
 * The card step is still real work: `useCardLink` runs the SetupIntent +
 * PaymentSheet and polls the reconcile, so its outcomes are passed through.
 */
export type MonthlyEnableOutcome =
  /** The period is open at the requested target. */
  | "ok"
  /** The advertiser backed out of the card sheet. Silent. */
  | "cancelled"
  /** The card link or the PUT failed. The caller alerts. */
  | "failed"
  /** The card link timed out — nothing was turned on. */
  | "cardUnverified";

export function useMonthlyEnable() {
  const router = useRouter();
  const qc = useQueryClient();
  const { linkCard } = useCardLink();

  const enable = async ({
    targetCents,
    needsCard,
    onVerifyingCard,
  }: {
    targetCents: number;
    /** True with no card on file, or when re-enabling after a decline. */
    needsCard: boolean;
    onVerifyingCard: () => void;
  }): Promise<{ outcome: MonthlyEnableOutcome; linkedCard: boolean }> => {
    let linkedCard = false;
    if (needsCard) {
      const cardOutcome = await linkCard({ onVerifying: onVerifyingCard });
      if (cardOutcome === "cancelled")
        return { outcome: "cancelled", linkedCard };
      if (cardOutcome === "failed") return { outcome: "failed", linkedCard };
      if (cardOutcome === "unverified")
        return { outcome: "cardUnverified", linkedCard };
      linkedCard = true;
    }

    const res = await callAuthed(router, (jwt) =>
      setMonthlyBudget({
        jwt,
        body: { targetCents, chargeAuthorized: true },
      }),
    );
    if (!res.ok || !res.data) return { outcome: "failed", linkedCard };

    // The period's state changed for every observer (the "How you pay" row, the
    // card sheet's job list). The response only says `{ active: true }`, so
    // refetch rather than patch.
    void qc.invalidateQueries({ queryKey: MONTHLY_BUDGET_STATE_QUERY_KEY });
    return { outcome: "ok", linkedCard };
  };

  return { enable };
}
