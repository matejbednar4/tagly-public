import { notificationsWorkerTunables as T } from "../../../constants/workers/NOTIFICATIONS.js";
import sleep from "../../../utils/core/sleep.js";

type Bucket = { tokens: number; lastRefill: number };

/**
 * In-memory token-bucket rate limiter. Returns a `throttle(key)` that resolves
 * immediately while the key has tokens, else waits until one refills. One bucket
 * `Map` per process — fine while the notifications worker is a single replica; if
 * it ever scales out, this moves to a Redis token bucket (see v2.0.0.md §7).
 */
function makeTokenBucket({
  capacity,
  refillPerSec,
}: {
  capacity: number;
  refillPerSec: number;
}) {
  const buckets = new Map<string, Bucket>();

  return async function throttleToken(key: string) {
    // Loop until a token is actually acquired: the check-and-consume is atomic
    // between awaits (single-threaded), so N concurrent waiters on one key
    // wake, ONE wins the token, and the rest loop back to sleep — without the
    // loop, everyone who slept once proceeded together and nothing throttled.
    for (;;) {
      const now = Date.now();
      let b = buckets.get(key);
      if (!b) {
        b = { tokens: capacity, lastRefill: now };
        buckets.set(key, b);
      }
      const elapsed = (now - b.lastRefill) / 1000;
      if (elapsed > 0) {
        b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
        b.lastRefill = now;
      }
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - b.tokens) / refillPerSec) * 1000);
      await sleep(waitMs);
    }
  };
}

export const throttleEmailRecipient = T.email.throttlePerRecipient
  ? makeTokenBucket({ capacity: 1, refillPerSec: T.email.perRecipientRps })
  : async () => {};

export const throttlePushToken = T.push.throttlePerToken
  ? makeTokenBucket({ capacity: 1, refillPerSec: T.push.perTokenRps })
  : async () => {};
