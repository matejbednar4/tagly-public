import prisma from "../../../prisma/prisma.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import { PROCESSING_SHARE_WHERE } from "../../../utils/shares/shareAccess.js";
import { markShareUnpayableAndUnlock } from "../../../utils/shares/markShareUnpayableAndUnlock.js";
import { reportWorkerError } from "../../runtime/reportWorkerError.js";
import { sampleIds } from "../../helpers/sampleIds.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Backstop for the non-atomic terminal-job transition: a share still PROCESSING
 * whose insights or snapshot queue row is FAILED is a stranding — the job died
 * terminally but the share void (UNPAYABLE flip + budget-lock release) never
 * committed. That state matches no other recovery predicate in the system:
 * `expireInsightsJobs` wants SCHEDULED/PROCESSING jobs, `requeueStuckJobs`
 * wants PROCESSING jobs, `recoverStuck*Budget` wants an already-dead share, and
 * `findSharesReadyForPayment` wants data that was never written. Without this
 * sweep the advertiser's lock is held forever.
 *
 * The queue runner now voids BEFORE stamping FAILED, so new strandings of this
 * shape should not occur — this sweep exists for (a) rows stranded under the
 * old ordering (the bug is PREEXISTING; prod may hold some), and (b) any future
 * path that stamps FAILED without the void. It must run inside cleanup's
 * FAILED-row retention (`keepFinishedIgJobsMs`, 7 days) — after that the FAILED
 * row is deleted and the stranding becomes invisible again.
 *
 * `markShareUnpayableAndUnlock` is a PROCESSING-guarded CAS, so racing the
 * runner (or re-running the sweep) is safe — the loser no-ops. The grace
 * window keeps the sweep from racing a terminal path the runner is executing
 * right now.
 */
const GRACE_MS = 15 * 60 * 1000; // 15 min — well past any single terminal path

export const voidSharesWithFailedJobs: MaintenanceTask = {
  name: "void shares stranded by failed jobs",
  run: async ({ now, log }) => {
    const grace = new Date(now.getTime() - GRACE_MS);

    const stranded = await prisma.share.findMany({
      where: {
        ...PROCESSING_SHARE_WHERE,
        OR: [
          {
            instagramInsightsQueue: {
              is: { status: "FAILED", finishedAt: { lt: grace } },
            },
          },
          {
            instagramSnapshotQueue: {
              is: { status: "FAILED", finishedAt: { lt: grace } },
            },
          },
        ],
      },
      take: T.fetchBatchSize,
      select: { id: true, uid: true },
    });

    if (stranded.length === 0) return;

    const ids = stranded.map((s) => s.id);
    log.info(
      `(FAILED_JOB_SHARES) found ${ids.length} PROCESSING shares with a FAILED queue row (ids: ${sampleIds(ids)})`,
    );

    let voided = 0;
    for (const share of stranded) {
      try {
        const res = await prisma.$transaction((tx) =>
          markShareUnpayableAndUnlock(tx, {
            shareId: share.id,
            reason: "INSIGHTS_UNAVAILABLE",
            detail:
              "insights/snapshot job failed terminally but the share was never voided (recovered by maintenance sweep)",
          }),
        );
        if (res.voided) {
          voided++;
          // Each of these is a stranding a crash created — money was locked
          // with no owner. Keep them individually visible.
          reportWorkerError(
            new Error("stranded share voided by failed-jobs sweep"),
            {
              worker: "maintenance",
              phase: "task",
              task: "voidSharesWithFailedJobs",
              shareId: share.id,
              shareUid: share.uid,
            },
          );
        }
      } catch (e) {
        reportWorkerError(e, {
          worker: "maintenance",
          phase: "task",
          task: "voidSharesWithFailedJobs",
          shareId: share.id,
        });
      }
    }

    log.info(
      `(FAILED_JOB_SHARES) voided ${voided}/${ids.length} stranded shares`,
    );
  },
};
