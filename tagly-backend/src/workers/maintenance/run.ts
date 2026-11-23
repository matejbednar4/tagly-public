import { LOCK_KEYS } from "../../constants/platform/POSTGRES_LOCKS.js";
import { jobMaintenanceTunables as T } from "../../constants/workers/JOB_MAINTENANCE.js";
import { runWorkerLoop } from "../runtime/runWorkerLoop.js";
import { reportWorkerError } from "../runtime/reportWorkerError.js";
import { workerLogger } from "../runtime/workerLogger.js";
import { maintenanceTasks } from "./tasks/index.js";

const WORKER = "maintenance";
const log = workerLogger(WORKER);

/**
 * Maintenance worker — periodic recovery + re-engagement (tasks in `tasks/`).
 *
 * Singleton via the JOB_MAINTENANCE advisory lock (owned by the harness) so only
 * one instance runs at a time. Each task is isolated: a failing task is reported
 * and the rest still run. Every task is idempotent, so a failed task just retries
 * next cycle.
 *
 * Tasks: requeue stuck notification/insights/snapshot jobs, fail expired insights
 * jobs (unlock budget), reclaim stranded advertiser + platform budget, and
 * schedule pending-customer / first-share / inactivity nudges.
 */
export function runMaintenanceWorker() {
  return runWorkerLoop({
    name: WORKER,
    tunables: T,
    singleton: LOCK_KEYS.JOB_MAINTENANCE,
    tick: async () => {
      log.info("cycle start");
      const now = new Date();

      for (const task of maintenanceTasks) {
        const t0 = Date.now();
        try {
          await task.run({ now, log });
          log.info("task finished", {
            task: task.name,
            durationMs: Date.now() - t0,
          });
        } catch (e) {
          reportWorkerError(e, { worker: WORKER, phase: "task", task: task.name });
        }
      }

      log.info("cycle complete");
    },
  });
}

// --- process entry (invoked directly by ops/entrypoint.sh) ---
runMaintenanceWorker().catch((e) => {
  reportWorkerError(e, { worker: WORKER, phase: "loop", fatal: true });
  process.exit(1);
});
