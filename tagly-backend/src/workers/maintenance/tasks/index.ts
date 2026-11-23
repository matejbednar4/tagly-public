import type { WorkerLogger } from "../../runtime/workerLogger.js";
import { requeueStuckNotificationJobs } from "./requeueStuckNotificationJobs.js";
import { requeueStuckInsightsJobs } from "./requeueStuckInsightsJobs.js";
import { expireInsightsJobs } from "./expireInsightsJobs.js";
import { requeueStuckSnapshotJobs } from "./requeueStuckSnapshotJobs.js";
import { voidSharesWithFailedJobs } from "./voidSharesWithFailedJobs.js";
import { recoverStuckAdvertiserBudget } from "./recoverStuckAdvertiserBudget.js";
import { recoverStuckPlatformBudget } from "./recoverStuckPlatformBudget.js";
import { reconcileAdvertiserVisibility } from "./reconcileAdvertiserVisibility.js";
import { schedulePendingCustomerNudges } from "./schedulePendingCustomerNudges.js";
import { scheduleFirstShareNudges } from "./scheduleFirstShareNudges.js";
import { scheduleInactivityReminders } from "./scheduleInactivityReminders.js";
import { scheduleAdvertiserAddBudgetNudges } from "./scheduleAdvertiserAddBudgetNudges.js";
import { scheduleMonthlyBudgetNotices } from "./scheduleMonthlyBudgetNotices.js";

/** Everything a maintenance task needs from the cycle. */
export type MaintenanceTaskContext = {
  /** The single `now` for the whole cycle (all tasks share it). */
  now: Date;
  log: WorkerLogger;
};

/**
 * One maintenance pass. Does its own detailed logging and its own per-item error
 * handling; a throw that escapes `run` is reported by the orchestrator, which
 * then moves on to the next task. Every task is idempotent, so a failed task just
 * retries next cycle.
 */
export type MaintenanceTask = {
  name: string;
  run: (ctx: MaintenanceTaskContext) => Promise<void>;
};

/**
 * All maintenance tasks, run in order each cycle. Recovery tasks first (requeue
 * stuck jobs, fail expired insights, reclaim stranded budget), then the
 * re-engagement nudges. Add a task by creating a file in this folder and listing
 * it here.
 */
export const maintenanceTasks: MaintenanceTask[] = [
  requeueStuckNotificationJobs,
  requeueStuckInsightsJobs,
  expireInsightsJobs,
  requeueStuckSnapshotJobs,
  // Before the budget-recovery tasks: a stranded share voided here has its lock
  // released the normal way, so recoverStuck* never sees it as a false positive.
  voidSharesWithFailedJobs,
  recoverStuckAdvertiserBudget,
  recoverStuckPlatformBudget,
  // After the budget-recovery tasks, so a reclaimed lock is already reflected
  // in the visibility snapshot this same cycle.
  reconcileAdvertiserVisibility,
  schedulePendingCustomerNudges,
  scheduleFirstShareNudges,
  scheduleInactivityReminders,
  scheduleAdvertiserAddBudgetNudges,
  // Not a re-engagement nudge: it announces a scheduled charge. It lives in
  // this worker (not the stripe one) because it moves no money — see the
  // task's docblock.
  scheduleMonthlyBudgetNotices,
];
