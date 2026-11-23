/**
 * Post-PaymentSheet verification polling, shared by the two billing sheets
 * (`PaygSheet`, `AddCreditsSheet`). After the native sheet reports success the
 * money truth still lands asynchronously (Stripe webhook / reconcile), so the
 * sheets poll the backend before showing success — and give up into a
 * "we couldn't verify" state after the budget below.
 */

/** Gap between verification polls. */
export const VERIFY_POLL_INTERVAL_MS = 2_000;
/** Poll attempts before giving up (~20s total with the interval above). */
export const VERIFY_POLL_MAX_ATTEMPTS = 10;
/** How long the in-sheet success beat stays up before the flow advances. */
export const SUCCESS_BEAT_MS = 1400;

/**
 * Run `check` up to `maxAttempts` times, `intervalMs` apart, until it returns
 * a non-null terminal value. Returns that value, or `null` when every attempt
 * came back null (verification timed out). The first attempt runs immediately;
 * the interval only separates attempts.
 */
export async function pollUntil<T>(
  check: (attempt: number) => Promise<T | null>,
  {
    intervalMs = VERIFY_POLL_INTERVAL_MS,
    maxAttempts = VERIFY_POLL_MAX_ATTEMPTS,
  }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    const result = await check(attempt);
    if (result !== null) return result;
  }
  return null;
}
