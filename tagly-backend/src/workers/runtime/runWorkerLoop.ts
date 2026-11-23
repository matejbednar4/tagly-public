import sleep from "../../utils/core/sleep.js";
import { jitter } from "../helpers/jitter.js";
import { withAdvisoryLock } from "../../utils/core/db/advisoryLock.js";
import { workerLogger, type WorkerLogger } from "./workerLogger.js";
import { reportWorkerError } from "./reportWorkerError.js";
import { shutdownPostHog } from "../../utils/clients/posthog.js";
import type { WorkerLoopTunables } from "../../constants/workers/types.js";

// Installed once per worker process (a worker runs exactly one `runWorkerLoop`).
// Guarded so the loop-error backoff in the loop below and these fatal handlers
// don't double-register if a process ever nested two loops.
let processHandlersInstalled = false;

/**
 * Process-level crash capture — the errors that escape the tick try/catch
 * entirely (a floating promise rejection, a throw off the event loop). Reports
 * through the same `reportWorkerError` chokepoint as `class: "crash"`, flushes
 * the tracker, then exits non-zero so ECS restarts the task. This replaces the
 * hand-rolled `runXWorker().catch(process.exit)` each worker used to carry.
 */
function installProcessCrashHandlers(worker: string) {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;

  const onFatal = (phase: "uncaughtException" | "unhandledRejection") => (
    err: unknown
  ) => {
    reportWorkerError(err, { worker, phase: "process", crashKind: phase, fatal: true });
    void shutdownPostHog().finally(() => process.exit(1));
  };

  process.on("uncaughtException", onFatal("uncaughtException"));
  process.on("unhandledRejection", onFatal("unhandledRejection"));
}

/** Read-only view of the shutdown flag, for ticks that want to bail mid-batch. */
export type ShutdownSignal = { readonly shuttingDown: boolean };

export type TickContext = {
  log: WorkerLogger;
  signal: ShutdownSignal;
};

export type WorkerLoopConfig = {
  /** Stable worker name — the log tag + reportError context. */
  name: string;
  /** Loop tunables (idle + error-sleep + optional jitter). */
  tunables: WorkerLoopTunables;
  /**
   * One unit of work. Return `true` to signal "there may be more — loop again
   * immediately without the idle sleep" (drain a backlog). Return `false`/void
   * to pace at `loopIdleMs`. A throw is caught → reported → `errorSleepMs`.
   */
  tick: (ctx: TickContext) => Promise<boolean | void>;
  /**
   * If set, each tick runs only while holding this Postgres advisory lock
   * (singleton workers). When another instance holds it, the loop idles without
   * running the tick.
   */
  singleton?: bigint;
};

/**
 * The one poll-loop every worker runs. Owns: SIGTERM/SIGINT graceful drain,
 * idle pacing (with optional jitter), loop-level error backoff, the single
 * `reportWorkerError` wiring for loop crashes, lifecycle logging, and the
 * optional advisory-lock singleton wrap. Each worker supplies only its `tick`.
 */
export async function runWorkerLoop(config: WorkerLoopConfig): Promise<void> {
  const { name, tunables, tick, singleton } = config;
  const log = workerLogger(name);

  installProcessCrashHandlers(name);

  let shuttingDown = false;
  const signal: ShutdownSignal = {
    get shuttingDown() {
      return shuttingDown;
    },
  };
  const requestShutdown = (sig: string) => () => {
    log.info("received signal, finishing current work", { signal: sig });
    shuttingDown = true;
  };
  process.on("SIGTERM", requestShutdown("SIGTERM"));
  process.on("SIGINT", requestShutdown("SIGINT"));

  const idle = () =>
    sleep(
      tunables.jitterPct
        ? jitter(tunables.loopIdleMs, tunables.jitterPct)
        : tunables.loopIdleMs,
    );

  log.info("starting");

  while (!shuttingDown) {
    let busy = false;
    try {
      if (singleton) {
        const ran = await withAdvisoryLock(singleton, async () => {
          busy = (await tick({ log, signal })) === true;
        });
        if (!ran) {
          await idle();
          continue;
        }
      } else {
        busy = (await tick({ log, signal })) === true;
      }
    } catch (err) {
      reportWorkerError(err, { worker: name, phase: "loop" });
      await sleep(tunables.errorSleepMs);
      continue;
    }

    if (!shuttingDown && !busy) await idle();
  }

  // Drain the tracker before the process exits so the last batch of captured
  // exceptions isn't lost on a graceful SIGTERM recycle.
  await shutdownPostHog();

  log.info("graceful shutdown complete");
}
