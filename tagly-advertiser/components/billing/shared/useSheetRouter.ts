import { useRef, useState } from "react";

/**
 * One sheet at a time, and **never two `Modal`s mounted at once**.
 *
 * `BottomSheet` renders an RN `Modal` that stays mounted through its exit
 * animation (and up to `EXIT_WATCHDOG_MS` if the completion callback is
 * dropped). So flipping straight from one sheet to another — which is what
 * "Manage card" inside the PAYG or monthly sheet does — mounts the incoming
 * Modal while the outgoing one is still dismissing. iOS will not present two,
 * and the lingering one keeps swallowing touches: the app looks frozen and
 * nothing is pressable.
 *
 * So a hand-off is a **swap**: close the current sheet, wait for it to report
 * that it actually unmounted (`BottomSheet`'s `onClosed`, which fires from the
 * animation OR the watchdog — so a dropped callback can't strand the queue),
 * then open the next. Waiting on the real unmount rather than a guessed delay
 * is what makes it correct on a slow device.
 *
 * Hosts wire it as: `open` / `close` for ordinary entries and exits, `swapTo`
 * for a sheet-to-sheet hand-off, and `handleClosed` passed to every sheet that
 * can be swapped *away from*.
 */
export function useSheetRouter<K extends string>() {
  const [sheet, setSheet] = useState<K | null>(null);
  /** The sheet queued behind the one currently animating out. */
  const pending = useRef<K | null>(null);

  /** Open directly (nothing else is showing). */
  const open = (key: K) => {
    pending.current = null;
    setSheet(key);
  };

  const close = () => {
    pending.current = null;
    setSheet(null);
  };

  /** Hand off from the open sheet to another one. */
  const swapTo = (key: K) => {
    pending.current = key;
    setSheet(null);
  };

  /**
   * Pass to every swappable sheet's `onClosed`. Returns **true when a queued
   * sheet was opened** — i.e. the chain continues — so a host can tell "this
   * sheet closed" from "the surface is now empty" and only act on the latter.
   */
  const handleClosed = (): boolean => {
    const next = pending.current;
    if (!next) return false;
    pending.current = null;
    setSheet(next);
    return true;
  };

  return { sheet, open, close, swapTo, handleClosed };
}
