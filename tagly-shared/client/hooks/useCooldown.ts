import { useCallback, useEffect, useState } from "react";

/**
 * A simple client-side cooldown timer for rate-limiting an action. Call `start()`
 * to begin a cooldown of `durationMs`; `active` stays true while it runs and
 * `secondsLeft` counts down to 0 (recomputed from a wall-clock end time, so it
 * stays correct even if the device sleeps). When it reaches 0 it clears itself.
 *
 * Example — rate-limit a refresh to once a minute:
 *   const { active, secondsLeft, start } = useCooldown(60_000);
 *   const onRefresh = () => { if (active) return; doRefresh(); start(); };
 */
export function useCooldown(durationMs: number) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const start = useCallback(() => {
    setEndsAt(Date.now() + durationMs);
  }, [durationMs]);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setEndsAt(null);
    };
    tick();
    // 250ms so the visible second flips promptly without drifting.
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return { secondsLeft, active: endsAt !== null, start };
}
