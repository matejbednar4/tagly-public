import { useEffect, useState } from "react";
import { localGet } from "@tagly/client";
import { LOCAL_KEYS } from "@/constants/storageKeys";

/** Steps in the post-sign-in setup phase: payment (1), business page (2). */
const SETUP_STEPS_TOTAL = 2;

/**
 * Step-overline position for a setup-phase screen, continuing the onboarding
 * count across the sign-in boundary. A fresh registration wrote how many
 * onboarding steps it counted into `SETUP_STEP_BASE` at finish-registration,
 * so payment renders "3 of 4"; a plain login with setup pending has no base
 * and renders "1 of 2". Null until the stored base resolves (render nothing).
 *
 * @param position 1-based position within the setup phase (payment = 1).
 */
export function useSetupProgress(
  position: number,
): { step: number; total: number } | null {
  const [progress, setProgress] = useState<{
    step: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await localGet(LOCAL_KEYS.SETUP_STEP_BASE);
      const base = raw ? Number(raw) || 0 : 0;
      if (!cancelled) {
        setProgress({ step: base + position, total: base + SETUP_STEPS_TOTAL });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [position]);

  return progress;
}
