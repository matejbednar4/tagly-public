import prisma from "../../../prisma/prisma.js";
import { reportWorkerError } from "../../runtime/reportWorkerError.js";
import { jobMaintenanceTunables as T } from "../../../constants/workers/JOB_MAINTENANCE.js";
import { MONTHLY_BUDGET_TOPUP } from "../../../constants/billing/MONTHLY_BUDGET.js";
import { MONTHLY_BUDGET } from "@tagly/models/shared";
import { formatUsdCents } from "../../../utils/money/monthlyBudget/runMonthlyBudgetTopUp.js";
import { monthlyBudgetPeriodKey } from "../../../utils/money/monthlyBudget/monthlyBudgetSchedule.js";
import { queueNotificationJobs } from "../../../utils/queue/queueNotificationJobs.js";
import type { MaintenanceTask } from "./index.js";

/**
 * Queues the "your monthly top-up is coming up" email ~3 days before a
 * `MonthlyBudgetPeriod`'s `nextRunAt`.
 *
 * Lives here rather than beside the charge itself (`reconcileMonthlyBudgets`,
 * stripe worker) because it is a scheduled nudge, not a money movement: it
 * makes no Stripe call, and the stripe worker's 10s tick and singleton
 * advisory lock exist for charging. Nothing couples the two — a period is
 * either due (`nextRunAt <= now`, the charge pass) or announced here
 * (`nextRunAt > now + MIN_LEAD`), never both in one cycle.
 *
 * Sent only while the run is still at least `UPCOMING_NOTICE_MIN_LEAD_MS` away
 * (a worker catching up after downtime must not announce a charge that is
 * minutes out), only for a first attempt (`chargeAttempts = 0`: retries are
 * hours apart and were already announced), only if the period existed when the
 * window opened (an advertiser who enables on the 29th was just told in the app
 * when their first charge lands; the same warning by email two days later is
 * noise), only if the run would actually charge (`target − available ≥
 * MIN_TOPUP_CENTS` at that tick — an "already at target" notice is not sent,
 * and the period stays unclaimed so later spending inside the window still gets
 * one), and at most once per run — claimed with a CAS on `upcomingNoticeSentAt`,
 * since finished queue rows are pruned faster than the window is long.
 */
export const scheduleMonthlyBudgetNotices: MaintenanceTask = {
  name: "schedule monthly top-up notices",
  run: async ({ now, log }) => {
    const lead = MONTHLY_BUDGET_TOPUP.UPCOMING_NOTICE_LEAD_MS;
    // The run must be between MIN_LEAD and LEAD away: far enough that a
    // heads-up is useful, near enough that it is this run's notice.
    const earliestRunAt = new Date(
      now.getTime() + MONTHLY_BUDGET_TOPUP.UPCOMING_NOTICE_MIN_LEAD_MS,
    );
    const latestRunAt = new Date(now.getTime() + lead);
    const candidates = await prisma.monthlyBudgetPeriod.findMany({
      where: {
        endedAt: null,
        chargeAttempts: 0,
        nextRunAt: { gt: earliestRunAt, lte: latestRunAt },
        // A notice sent for THIS run is at least `nextRunAt − lead` old, which
        // is later than `now − lead` (nextRunAt > now) — so anything older than
        // `now − lead` was for a previous run.
        OR: [
          { upcomingNoticeSentAt: null },
          { upcomingNoticeSentAt: { lt: new Date(now.getTime() - lead) } },
        ],
      },
      select: {
        id: true,
        advertiserId: true,
        targetCents: true,
        nextRunAt: true,
        startedAt: true,
        upcomingNoticeSentAt: true,
      },
      take: T.fetchBatchSize,
    });

    let queued = 0;
    for (const period of candidates) {
      const runAt = period.nextRunAt!;
      const windowStart = new Date(runAt.getTime() - lead);
      // Enabled after the window opened → skip this run's notice.
      if (period.startedAt > windowStart) continue;
      try {
        // Only announce a charge that would actually happen. Evaluated BEFORE
        // the claim, and a zero estimate leaves the period unclaimed: a
        // heads-up about "nothing" is noise, and if the advertiser spends
        // below the floor later in the window, that tick sends the notice.
        const adv = await prisma.advertiser.findUnique({
          where: { id: period.advertiserId },
          select: {
            sensitiveData: { select: { availableBudgetUsdCents: true } },
          },
        });
        const available = adv?.sensitiveData?.availableBudgetUsdCents ?? 0n;
        const shortfall = period.targetCents - available;
        if (shortfall < BigInt(MONTHLY_BUDGET.MIN_TOPUP_CENTS)) continue;

        // CAS: whoever flips upcomingNoticeSentAt owns the send.
        const claimed = await prisma.monthlyBudgetPeriod.updateMany({
          where: {
            id: period.id,
            endedAt: null,
            upcomingNoticeSentAt: period.upcomingNoticeSentAt,
          },
          data: { upcomingNoticeSentAt: now },
        });
        if (claimed.count === 0) continue;

        await queueNotificationJobs({
          eventSlug: "a.balance.monthly-budget-upcoming",
          advertiserIds: [period.advertiserId],
          payload: {
            targetFormatted: formatUsdCents(period.targetCents),
            estimatedFormatted: formatUsdCents(shortfall),
            chargeDate: runAt.toISOString(),
          },
          dedupeKey: `monthly-budget-upcoming:${period.advertiserId}:${monthlyBudgetPeriodKey(runAt)}`,
        });
        queued++;
      } catch (err) {
        reportWorkerError(err, {
          worker: "maintenance",
          phase: "task",
          task: "scheduleMonthlyBudgetNotices",
          periodId: period.id,
          advertiserId: period.advertiserId,
        });
      }
    }

    if (queued > 0) {
      log.info(
        `(MONTHLY_TOPUP_NOTICE) queued ${queued} notices for ${candidates.length} candidate periods`,
      );
    }
  },
};
