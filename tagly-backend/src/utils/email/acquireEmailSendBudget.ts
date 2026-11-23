import { redis } from "../clients/redis.js";
import sleep from "../core/sleep.js";
import { RESEND } from "../../constants/integrations/RESEND.js";

/**
 * Global (cross-process, Redis-backed) send-rate budget for WORKER email
 * sends — the E057 guard. The notifications worker consumes from a fixed
 * window of `RESEND.WORKER_BUDGET.maxSends` per `windowMs` (atomic INCR on a
 * per-window key), sized below the Resend ACCOUNT rate limit so inline
 * OTP/security mail from the API instances always has reserved headroom and a
 * promo blast can never 429 a login code.
 *
 * Resolves when a slot is acquired, sleeping across window boundaries until
 * one frees up. **Fail-open on every edge**: a Redis error, or waiting longer
 * than `MAX_BUDGET_WAIT_MS`, resolves immediately — a budget outage costs
 * pacing, never delivery (mirrors the rate-limiter/caching Redis contract).
 *
 * Deliberately NOT called by the inline `sendOTPEmail`/API path: the headroom
 * IS its lane, and a login code must never sleep behind promo mail.
 */
export async function acquireEmailSendBudget(): Promise<void> {
  const { windowMs, maxSends } = RESEND.WORKER_BUDGET;
  const deadline = Date.now() + RESEND.MAX_BUDGET_WAIT_MS;

  for (;;) {
    try {
      const now = Date.now();
      const window = Math.floor(now / windowMs);
      const key = `email-send-budget:${window}`;

      const count = await redis.incr(key);
      // First writer stamps the TTL (2 windows: generous, avoids key leak
      // without racing the window's own consumers).
      if (count === 1) await redis.pexpire(key, windowMs * 2);
      if (count <= maxSends) return;

      // Window exhausted — sleep to the next window boundary (small random
      // stagger so concurrent waiters don't stampede the same INCR).
      const waitMs =
        (window + 1) * windowMs - now + Math.floor(Math.random() * 50);
      if (now + waitMs > deadline) return; // fail-open past the cap
      await sleep(waitMs);
    } catch {
      // Redis unreachable (rejects fast: offline queue off) — fail open. The
      // client's own throttled error listener reports the outage.
      return;
    }
  }
}
