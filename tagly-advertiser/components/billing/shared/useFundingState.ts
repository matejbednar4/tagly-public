import { MONTHLY_BUDGET } from "@tagly/models/shared";
import type {
  MonthlyBudgetStatus,
  PaygStatus,
  SavedCard,
} from "@tagly/models/v2/advertiserApp";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { useMonthlyBudgetState } from "./useMonthlyBudgetState";
import { usePaygState } from "./usePaygState";
import { useSavedCard } from "./useSavedCard";

/**
 * THE funding view model — one hook composing `/me` (balances, funded) with the
 * three shared queries (monthly top-up, pay as you go, saved card) into the
 * single shape every funding surface reads.
 *
 * It exists because the same facts were being re-derived per surface, and the
 * derivations are the kind that must never disagree: the pay-now estimate in
 * particular is the **worker's own rule** (`target − available`, dropped when it
 * falls under `MIN_TOPUP_CENTS`), so a card, a row and a sheet quoting different
 * numbers for the same charge would be a correctness bug, not a polish one. It
 * is computed here, once.
 *
 * Nothing here re-implements a card or period rule — `status` on both features
 * is server-derived (`derivePaygStatus` / `deriveMonthlyBudgetStatus`) and is
 * passed through untouched.
 */
export type FundingState = {
  /** First load of any part still in flight (surfaces hold their layout). */
  loading: boolean;
  /** Server-derived: an open PAYG period, a positive balance, or any past
   *  purchase. The one gate between "sell the methods" and "report state". */
  funded: boolean;
  availableCents: number;
  lockedCents: number;
  /** An uncollected charge left the account owing money. */
  negative: boolean;
  /** The account's ONE off-session card (null while loading or absent). */
  card: SavedCard | null;
  hasCard: boolean;
  monthly: {
    status: MonthlyBudgetStatus;
    active: boolean;
    targetCents: number | null;
    nextChargeAt: string | null;
    /** A charge declined and the ladder is still retrying this month. */
    pendingRetry: boolean;
    /** What the next run charges at TODAY's balance — the worker's own rule.
     *  0 means nothing would be charged (already at or above target, or under
     *  the minimum top-up). */
    estimateCents: number;
  };
  payg: {
    status: PaygStatus;
    active: boolean;
  };
};

export function useFundingState({
  enabled = true,
}: { enabled?: boolean } = {}): FundingState {
  const { advertiser } = useAdvertiser();
  const monthlyQuery = useMonthlyBudgetState({ enabled });
  const paygQuery = usePaygState({ enabled });
  const cardQuery = useSavedCard({ enabled });

  const budgets = advertiser?.budgets;
  const availableCents = budgets?.availableCents ?? 0;
  const lockedCents = budgets?.lockedCents ?? 0;

  const monthly = monthlyQuery.data ?? null;
  const payg = paygQuery.data ?? null;
  const card = cardQuery.data?.card ?? null;

  const targetCents = monthly?.targetCents ?? null;
  const monthlyActive = monthly?.active === true && targetCents != null;

  // The worker's rule, in one place: top up to the target, but skip a shortfall
  // under the shared floor (the run would be a no-op, so the UI must not
  // promise a charge).
  const shortfall = monthlyActive
    ? Math.max((targetCents ?? 0) - availableCents, 0)
    : 0;
  const estimateCents =
    shortfall >= MONTHLY_BUDGET.MIN_TOPUP_CENTS ? shortfall : 0;

  return {
    loading:
      enabled &&
      (monthlyQuery.isPending || paygQuery.isPending || cardQuery.isPending),
    funded: advertiser?.funded === true,
    availableCents,
    lockedCents,
    negative: availableCents < 0,
    card,
    // `hasCard` is authoritative on either read; prefer the card query, fall
    // back to whichever feature endpoint has answered.
    hasCard:
      cardQuery.data?.hasCard ?? monthly?.hasCard ?? payg?.hasCard ?? false,
    monthly: {
      status: monthly?.status ?? "NOT_ACTIVE",
      active: monthlyActive,
      targetCents,
      nextChargeAt: monthly?.nextChargeAt ?? null,
      pendingRetry: monthly?.pendingRetry === true,
      estimateCents,
    },
    payg: {
      status: payg?.status ?? budgets?.paygStatus ?? "NOT_LINKED",
      active: payg?.active ?? budgets?.paygActive === true,
    },
  };
}
