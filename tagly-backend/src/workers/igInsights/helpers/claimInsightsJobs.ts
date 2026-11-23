import type { Share } from "../../../generated/prisma/client.js";
import { claimJobsByIds, type ClaimContext } from "../../runtime/jobQueue.js";

/** Hydrated insights job — the fields the runner + `executeInsightsJob` read. */
export type InsightsJob = {
  id: number;
  attempts: number;
  validUntil: Date | null;
  scheduledAt: Date;
  share: Pick<Share, "id" | "igPostId" | "igPostType" | "customerId">;
};

/**
 * Two-phase priority claim: expiring jobs (`validUntil > now`, soonest first)
 * are claimed before non-expiring ones, because story insights have a hard 24h
 * window. Built on the shared `claimJobsByIds` CAS; returns the claimed jobs
 * hydrated and re-sorted so the expiring ones are processed first.
 */
export async function claimInsightsJobs(
  ctx: ClaimContext,
): Promise<InsightsJob[]> {
  const { now, batchSize: need, leaseMs, table } = ctx;
  const claimedIds: number[] = [];

  // Phase 1 — expiring jobs (validUntil > now), soonest-to-expire first.
  const dueExpiring = await table.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
      validUntil: { gt: now },
    },
    orderBy: [{ validUntil: "asc" }, { scheduledAt: "asc" }],
    take: need,
    select: { id: true },
  });
  const expiring = await claimJobsByIds(table, {
    ids: dueExpiring.map((j: { id: number }) => j.id),
    now,
    leaseMs,
    extraWhere: { scheduledAt: { lte: now }, validUntil: { gt: now } },
  });
  claimedIds.push(...expiring);

  // Phase 2 — non-expiring jobs (validUntil = null), only if we still need more.
  if (claimedIds.length < need) {
    const dueNoTtl = await table.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
        validUntil: null,
      },
      orderBy: { scheduledAt: "asc" },
      take: need - claimedIds.length,
      select: { id: true },
    });
    const noTtl = await claimJobsByIds(table, {
      ids: dueNoTtl.map((j: { id: number }) => j.id),
      now,
      leaseMs,
      extraWhere: { scheduledAt: { lte: now }, validUntil: null },
    });
    claimedIds.push(...noTtl);
  }

  if (claimedIds.length === 0) return [];

  const jobs = (await table.findMany({
    where: { id: { in: claimedIds } },
    select: {
      id: true,
      validUntil: true,
      scheduledAt: true,
      attempts: true,
      share: {
        select: {
          id: true,
          igPostId: true,
          igPostType: true,
          customerId: true,
        },
      },
    },
  })) as InsightsJob[];

  // Expiring first (earliest validUntil), then no-TTL by scheduledAt.
  return jobs.sort((a, b) => {
    const aHas = !!a.validUntil;
    const bHas = !!b.validUntil;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (aHas && bHas) {
      const diff = a.validUntil!.getTime() - b.validUntil!.getTime();
      if (diff !== 0) return diff;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    }
    return a.scheduledAt.getTime() - b.scheduledAt.getTime();
  });
}
