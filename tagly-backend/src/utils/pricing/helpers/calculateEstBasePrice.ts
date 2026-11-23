import { ECPM_FOR_ESTIMATES_CENTS } from "../../../constants/rewards/ECPM.js";
import { REACH_FROM_FOLLOWER_COUNT } from "../../../constants/rewards/multipliers/REACH.js";
import { capReachAtFollowerBaseline } from "./capReachAtFollowerBaseline.js";
import prisma from "../../../prisma/prisma.js";

export async function calculateEstBasePrice({
  customerId,
  estimatedReach,
  followerCount,
}: {
  customerId: number;
  /** Fallback reach for customers without Instagram. Only used if real data is unavailable. */
  estimatedReach?: number;
  /**
   * Current follower baseline for the STORY reach cap. Each real reach sample is
   * capped at followerCount × multiplier before averaging, so a past
   * reshare-inflated share doesn't pull every future estimate up. When null / 0
   * (a near-zero-follower account — the exact reshare-exploit shape) the cap
   * falls to REACH_CAP.ABSOLUTE_REACH_FLOOR rather than being skipped. The caller
   * passes the latest snapshot's (or live) follower count. Assumes stories-only
   * monetization (samples are stories); revisit if reels/posts become payable.
   */
  followerCount?: number;
}): Promise<{
  basePriceCents: bigint;
  averageReach: number;
  usedEstimate: boolean;
}> {
  // Deliberately moderation-agnostic (no shareAccess gate): the reach sample is
  // Instagram's own reported view count, a fact independent of whether the share
  // was good/bad/rejected. A low-quality or rejected share still genuinely
  // reached N people, and that N is what predicts the next share's reach. Do NOT
  // add a LIVE/approved filter here — the reach history is a measurement, not a
  // reward. (Confirmed 2026-07-24.)
  const lastShares = await prisma.share.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      insights: { select: { reach: true } },
    },
  });

  // One reach sample per share (reach is type-agnostic on the unified table).
  // Cap each sample at the follower baseline so a business-reshare-inflated past
  // share can't inflate the estimate (mirrors the settlement-time cap). A null/0
  // follower count floors the cap (via the helper) rather than skipping it.
  const reachSamples: number[] = [];
  for (const s of lastShares) {
    if (s.insights?.reach != null) {
      const sample = Math.max(0, Math.trunc(s.insights.reach));
      reachSamples.push(capReachAtFollowerBaseline(sample, followerCount ?? 0));
    }
  }

  // If too few samples, supplement with a follower-based sample
  if (reachSamples.length < 3) {
    const instagram = await prisma.customerInstagramAccount.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { followerCount: true },
    });

    if (!instagram) {
      // No real Instagram data at all — fall back to story views estimate if provided.
      // If estimatedReach is also absent the caller should have returned early, but
      // treat it as zero-reach so we never throw here.
      const reach =
        estimatedReach != null && estimatedReach > 0
          ? Math.trunc(estimatedReach)
          : 0;
      const basePriceCents =
        (BigInt(reach) * BigInt(ECPM_FOR_ESTIMATES_CENTS)) / 1000n;
      return { basePriceCents, averageReach: reach, usedEstimate: true };
    }

    const followers = Math.max(0, Math.trunc(instagram.followerCount ?? 0));

    let take =
      REACH_FROM_FOLLOWER_COUNT.length > 0
        ? REACH_FROM_FOLLOWER_COUNT[REACH_FROM_FOLLOWER_COUNT.length - 1].take
        : 0.3;

    for (const row of REACH_FROM_FOLLOWER_COUNT) {
      if (followers <= row.maxFollowerCount) {
        take = row.take;
        break;
      }
    }

    reachSamples.push(Math.max(0, Math.floor(followers * take)));
  }

  let total = 0;
  for (const r of reachSamples) total += r;
  const avgReach = Math.floor(total / reachSamples.length);

  const basePriceCents =
    (BigInt(avgReach) * BigInt(ECPM_FOR_ESTIMATES_CENTS)) / 1000n;

  return { basePriceCents, averageReach: avgReach, usedEstimate: false };
}
