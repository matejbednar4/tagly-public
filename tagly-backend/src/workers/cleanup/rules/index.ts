import { stalePendingMedia } from "./stalePendingMedia.js";
import { abandonedPendingLocals } from "./abandonedPendingLocals.js";
import { deletedLocals } from "./deletedLocals.js";
import { expiredInstagramTokens } from "./expiredInstagramTokens.js";
import { otpSessions } from "./otpSessions.js";
import { disabledPushTokens } from "./disabledPushTokens.js";
import { finishedInsightsJobs } from "./finishedInsightsJobs.js";
import { finishedNotificationJobs } from "./finishedNotificationJobs.js";
import { finishedSnapshotJobs } from "./finishedSnapshotJobs.js";
import { abandonedPendingSignups } from "./abandonedPendingSignups.js";
import { staleStripeEvents } from "./staleStripeEvents.js";

/** One cleanup pass; resolves to the number of rows deleted this cycle. */
export type CleanupRule = {
  name: string;
  run: (now: Date) => Promise<number>;
};

/**
 * All cleanup rules, run in order each cycle. Every rule only removes
 * expired/disabled/completed records, so re-running is always safe. Add a rule
 * by creating a file in this folder and listing it here.
 */
export const cleanupRules: CleanupRule[] = [
  stalePendingMedia,
  abandonedPendingLocals,
  deletedLocals,
  expiredInstagramTokens,
  otpSessions,
  disabledPushTokens,
  finishedInsightsJobs,
  finishedNotificationJobs,
  finishedSnapshotJobs,
  abandonedPendingSignups,
  staleStripeEvents,
];
