import { LOCK_KEYS } from "../../constants/platform/POSTGRES_LOCKS.js";
import { dbCleanupTunables as T } from "../../constants/workers/DB_CLEANUP.js";
import { runWorkerLoop } from "../runtime/runWorkerLoop.js";
import { reportWorkerError } from "../runtime/reportWorkerError.js";
import { workerLogger } from "../runtime/workerLogger.js";
import { cleanupRules } from "./rules/index.js";

const WORKER = "cleanup";
const log = workerLogger(WORKER);

/**
 * Database cleanup worker — removes stale/expired records (rules in `rules.ts`).
 *
 * Singleton via the DB_CLEANUP advisory lock (owned by the harness) so only one
 * instance runs at a time. Each rule is isolated: a failing rule is reported and
 * the rest still run. Deletes are idempotent, so a failed rule just retries next
 * cycle.
 */
function runDatabaseCleanupWorker() {
  return runWorkerLoop({
    name: WORKER,
    tunables: T,
    singleton: LOCK_KEYS.DB_CLEANUP,
    tick: async () => {
      log.info("cycle start");
      const now = new Date();

      for (const rule of cleanupRules) {
        const t0 = Date.now();
        try {
          const deleted = await rule.run(now);
          log.info("rule finished", {
            rule: rule.name,
            deleted,
            durationMs: Date.now() - t0,
          });
        } catch (e) {
          reportWorkerError(e, { worker: WORKER, phase: "task", rule: rule.name });
        }
      }

      log.info("cycle end");
    },
  });
}

// --- process entry (invoked directly by ops/entrypoint.sh) ---
runDatabaseCleanupWorker().catch((e) => {
  reportWorkerError(e, { worker: WORKER, phase: "loop", fatal: true });
  process.exit(1);
});
