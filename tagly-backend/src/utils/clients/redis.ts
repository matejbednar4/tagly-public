import Redis from "ioredis";
import { envVariables } from "../../environment/envVariables.js";
import { reportError } from "../core/errors/reportError.js";

// Shared Redis (ElastiCache Valkey) client singleton, imported wherever we need a
// cross-process store (rate limiters now; reward-estimate cache later). REDIS_URL
// is required in every environment (incl. local dev), so the client always exists.
//
// Consumers still FAIL OPEN on a runtime *outage*: with enableOfflineQueue off +
// maxRetriesPerRequest 1, commands reject fast while the cache is unreachable
// (instead of hanging), so each consumer can degrade (rate limiters fall back to
// in-memory, caches recompute) rather than error the request. A Redis problem
// costs performance, never availability.
//
// TLS is inferred from the URL scheme by ioredis: `rediss://` (staging/prod,
// in-transit encryption) turns TLS on and validates against the system CA store,
// which already trusts ElastiCache's public certificate — so no custom CA bundle
// is needed (unlike the RDS clients). `redis://` (local) is plaintext.
export const redis = new Redis(envVariables.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 10_000,
  // Keep reconnecting in the background with capped backoff.
  retryStrategy: (times) => Math.min(times * 200, 2_000),
});

// ioredis emits an 'error' event on every failed connection attempt; with no
// listener those are unhandled and crash the process. Swallow + report so a
// cache outage can never take the app/worker down but is still visible in the
// tracker. Throttled per process: reconnects fire every ~2s during an outage,
// and one event per window says everything a stream of identical ones would.
// (The redis→reportError→sendTeamAlertEmail→redis import cycle is safe: all
// cross-references resolve at call time, and `notify` is never set here.)
let lastRedisErrorReportAt = 0;
const REDIS_ERROR_REPORT_INTERVAL_MS = 5 * 60_000; // 5 minutes
redis.on("error", (err: Error) => {
  const now = Date.now();
  if (now - lastRedisErrorReportAt < REDIS_ERROR_REPORT_INTERVAL_MS) return;
  lastRedisErrorReportAt = now;
  reportError(err, {
    source: "system",
    errorClass: "transient",
    service: "redis",
  });
});

// Close the connection on graceful shutdown (SIGTERM/SIGINT).
export async function shutdownRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
