import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

/**
 * Resend cooldown, in seconds. Mirrors the backend's
 * `OTP.MIN_RESEND_INTERVAL_MS` (60s) so the UI never lets the user tap into a
 * `SENT_RECENTLY` error. Keep in sync if the backend constant changes.
 */
const RESEND_COOLDOWN_SECONDS = 60;

interface OtpSessionContextValue {
  /** Epoch ms of the last OTP send, or null if none this session. */
  lastSentAt: number | null;
  /** Seconds until a resend is allowed (0 = allowed now). Ticks down live. */
  secondsUntilResend: number;
  canResend: boolean;
  /** Record that an OTP was just sent — (re)starts the cooldown. */
  markOtpSent: () => void;
  /** Clear the session (e.g. once the code is verified). */
  reset: () => void;
}

const OtpSessionContext = createContext<OtpSessionContextValue | undefined>(
  undefined,
);

export function useOtpSession() {
  const ctx = useContext(OtpSessionContext);
  if (!ctx) {
    throw new Error("useOtpSession must be used within OtpSessionProvider");
  }
  return ctx;
}

/**
 * App-wide OTP send/cooldown tracker. Any OTP flow (onboarding today; login or
 * email-change later) calls `markOtpSent()` after a send; consumers read
 * `secondsUntilResend` / `canResend` to gate the resend button. State is
 * in-memory — an OTP in flight doesn't survive an app kill, and the user
 * re-requests on relaunch anyway. Advertiser mirror of the customer's context.
 */
export function OtpSessionProvider({ children }: { children: ReactNode }) {
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);

  // Run a 1s ticker only while a cooldown is active; it clears itself at 0.
  useEffect(() => {
    if (lastSentAt === null) {
      setSecondsUntilResend(0);
      return;
    }
    const computeRemaining = () =>
      Math.max(
        0,
        RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - lastSentAt) / 1000),
      );

    setSecondsUntilResend(computeRemaining());
    if (computeRemaining() === 0) return;

    const id = setInterval(() => {
      const remaining = computeRemaining();
      setSecondsUntilResend(remaining);
      if (remaining === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lastSentAt]);

  const value = useMemo<OtpSessionContextValue>(
    () => ({
      lastSentAt,
      secondsUntilResend,
      canResend: secondsUntilResend === 0,
      markOtpSent: () => setLastSentAt(Date.now()),
      reset: () => setLastSentAt(null),
    }),
    [lastSentAt, secondsUntilResend],
  );

  return (
    <OtpSessionContext.Provider value={value}>
      {children}
    </OtpSessionContext.Provider>
  );
}
