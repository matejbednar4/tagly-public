import { useEffect, useState } from "react";

/**
 * Live "time remaining until `target`", in **milliseconds**, recomputed from a
 * fixed wall-clock instant (so it stays correct even if the device sleeps). Counts
 * down to 0, then stops ticking. Pass `null` to disable (returns 0).
 *
 * Sibling to {@link useCooldown}: same 250ms wall-clock tick, but it counts toward
 * a fixed future instant rather than a duration measured from `start()`. Callers
 * format the returned ms however they need (e.g. "5h 23m left until reward").
 *
 * Example — show how long until a share's reward window matures:
 *   const msLeft = useTimeRemaining(rewardAt);
 *   msLeft > 0 ? `Reward in ${fmt(msLeft)}` : "Almost there";
 */
export function useTimeRemaining(
  target: Date | string | number | null,
): number {
  // Normalize to an epoch-ms number so the effect dep is a stable primitive
  // (a fresh Date/string each render wouldn't be referentially equal).
  const endsAt = target == null ? null : new Date(target).getTime();

  const [msLeft, setMsLeft] = useState(() =>
    endsAt === null ? 0 : Math.max(0, endsAt - Date.now()),
  );

  useEffect(() => {
    if (endsAt === null) {
      setMsLeft(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, endsAt - Date.now());
      setMsLeft(remaining);
      return remaining;
    };
    if (tick() <= 0) return; // already elapsed — no interval needed
    // 250ms so the visible minute flips promptly without drifting.
    const id = setInterval(() => {
      if (tick() <= 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return msLeft;
}
