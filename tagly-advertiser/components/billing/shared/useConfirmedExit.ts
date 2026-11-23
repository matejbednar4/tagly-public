import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { SUCCESS_BEAT_MS } from "@/utils/paymentVerification";
import { MONTHLY_BUDGET_STATE_QUERY_KEY } from "./useMonthlyBudgetState";
import { PAYG_STATE_QUERY_KEY } from "./usePaygState";
import { SAVED_CARD_QUERY_KEY } from "./useSavedCard";

/**
 * How every billing sheet leaves a confirmed money change — the last step of
 * the contract each sheet owns end to end: **hit the backend → re-read every
 * funding surface → show the confirmation → hand back to the host.**
 *
 * It refreshes **all four sources at once**: `/me` (balances, `funded`,
 * visibility) and the three shared queries (saved card, PAYG, monthly top-up).
 * That breadth is deliberate. The individual flows each patch or invalidate the
 * key they know about, but the account's funding state is entangled — enabling
 * the monthly top-up can link a card and move the balance; removing a card
 * closes two periods — so "which keys did this action touch?" is the wrong
 * question for a sheet to have to answer. Refreshing everything on the way out
 * is cheap (three small GETs, once per money action) and makes a stale wallet
 * structurally impossible rather than a thing each flow has to remember.
 *
 * `afterBeat` starts that refresh **immediately** and fires the host callback
 * only once it has settled, with the success beat running in parallel — so the
 * network time hides behind the animation and the host is guaranteed fresh
 * data. That guarantee is what E048 needs: the setup step dismisses its gate in
 * that callback, and dismissing on a stale boot cache lands a just-charged
 * advertiser on "NOT VISIBLE / $0.00".
 *
 * It also owns the timeout and its unmount cleanup, which every sheet
 * previously declared for itself.
 */
export function useConfirmedExit() {
  const { refresh } = useAdvertiser();
  const qc = useQueryClient();
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  /**
   * Re-read everything. `refetchQueries` (not `invalidateQueries`) so the read
   * actually happens now and can be awaited — an invalidation is fire-and-forget
   * and only marks staleness, which leaves the surfaces showing the old state
   * until something else happens to trigger a fetch. `allSettled` so one failing
   * endpoint can never strand the sheet.
   */
  const refreshAll = () =>
    Promise.allSettled([
      refresh(),
      qc.refetchQueries({ queryKey: MONTHLY_BUDGET_STATE_QUERY_KEY }),
      qc.refetchQueries({ queryKey: PAYG_STATE_QUERY_KEY }),
      qc.refetchQueries({ queryKey: SAVED_CARD_QUERY_KEY }),
    ]);

  /** Play the success beat, then hand back to the host with everything fresh. */
  const afterBeat = (done: () => void) => {
    const refreshed = refreshAll();
    timeout.current = setTimeout(() => {
      void refreshed.then(done, done);
    }, SUCCESS_BEAT_MS);
  };

  /** No beat (a turn-off, a removal): refresh, then hand back immediately. */
  const now = async (done: () => void) => {
    await refreshAll();
    done();
  };

  return { afterBeat, now };
}
