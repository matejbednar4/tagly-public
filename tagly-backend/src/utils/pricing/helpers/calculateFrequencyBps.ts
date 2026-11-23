import { FREQUENCY_MULTIPLIER } from "../../../constants/rewards/multipliers/FREQUENCY.js";
import prisma from "../../../prisma/prisma.js";
import type { RewardMessageSlug } from "@tagly/models/shared";

export type FrequencyData = {
  /** Prior shares in the trailing 24h, each with its localId (if any). */
  dayShares: { localId: number | null }[];
  /** Total shares in the trailing 7d. */
  weekCount: number;
};

/**
 * Fetches the rolling-window share data the frequency multiplier needs: the
 * customer's shares in the trailing 24h (with localId, to detect a repeat post
 * to the same business) and their total share count in the trailing 7d.
 *
 * Split out so a batch pricer can fetch this ONCE per customer and feed it to
 * many per-business `calculateFrequencyBps` calls via `prefetched` — both windows
 * are customer-level; only the same-business 24h check is per-business (a pure
 * lookup against `dayShares`).
 */
export async function fetchFrequencyData({
  customerId,
  shareId,
  since,
}: {
  customerId: number;
  shareId?: number;
  since: Date;
}): Promise<FrequencyData> {
  const anchor = since;

  const dayFrom = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
  const weekFrom = new Date(anchor.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Deliberately moderation-agnostic (no shareAccess gate): the frequency
  // dampener counts how often the customer actually POSTED, and a rejected/
  // voided share was still posted to Instagram. Filtering it out would let
  // someone farm frequency by getting shares rejected. Count every share.
  // Prior shares in the trailing 24h (excluding the current share)
  const dayShares = await prisma.share.findMany({
    where: {
      customerId,
      postedToIgAt: { gte: dayFrom, lte: anchor },
      id: shareId ? { not: shareId } : undefined,
    },
    select: { localId: true },
  });

  // Every share in the trailing week counts equally toward the weekly bucket.
  // Excludes the current share, same as the 24h window above: at settlement the
  // share's own row exists and `postedToIgAt = anchor` matches the inclusive
  // `lte`, so without the exclusion settlement counted one more share than the
  // estimate (no row yet at estimate time) and paid a full tier lower than
  // quoted from the customer's 3rd weekly share on (E071).
  const weekCount = await prisma.share.count({
    where: {
      customerId,
      postedToIgAt: { gte: weekFrom, lte: anchor },
      id: shareId ? { not: shareId } : undefined,
    },
  });

  return { dayShares, weekCount };
}

/**
 * Computes the frequency multiplier (in bps) that dampens a customer's reward as
 * they post more often, based on how many shares they've made in the last day/week.
 *
 * All shares are authentic, so prior shares are no longer weighted by type — each
 * one counts equally toward the weekly frequency bucket.
 *
 * Rules:
 * - Posting for the same business again within 24h → 0× (no reward).
 * - More shares in the trailing 24h / 7d → progressively smaller multipliers.
 *
 * Pass `prefetched` to reuse rolling-window data already fetched for this
 * customer (batch pricing); when absent we fetch it ourselves, so existing
 * single-call sites (share creation / final price) behave exactly as before.
 */
export async function calculateFrequencyBps({
  customerId,
  localId,
  shareId,
  since,
  prefetched,
}: {
  customerId: number;
  localId: number | null;
  shareId?: number;
  since: Date;
  prefetched?: FrequencyData;
}): Promise<{ bps: number; messageSlug?: RewardMessageSlug }> {
  const { dayShares, weekCount } =
    prefetched ?? (await fetchFrequencyData({ customerId, shareId, since }));

  const dayCount = dayShares.length;

  // Same business within 24h → 0×
  if (
    localId !== null &&
    dayShares.some((s) => s.localId !== null && s.localId === localId)
  ) {
    return {
      bps: 0,
      messageSlug: "FREQUENCY_SAME_BUSINESS_SAME_DAY",
    };
  }

  // Per-day multiplier
  let perDayMult = FREQUENCY_MULTIPLIER.perDay.firstShare;
  if (dayCount === 0) perDayMult = FREQUENCY_MULTIPLIER.perDay.firstShare;
  else if (dayCount === 1)
    perDayMult = FREQUENCY_MULTIPLIER.perDay.secondShareDifferentBusiness;
  else perDayMult = FREQUENCY_MULTIPLIER.perDay.thirdOrMore;

  // Per-week multiplier
  let perWeekMult = FREQUENCY_MULTIPLIER.perWeek.first;
  if (weekCount <= 1) perWeekMult = FREQUENCY_MULTIPLIER.perWeek.first;
  else if (weekCount <= 2) perWeekMult = FREQUENCY_MULTIPLIER.perWeek.second;
  else if (weekCount <= 3) perWeekMult = FREQUENCY_MULTIPLIER.perWeek.third;
  else if (weekCount <= 4) perWeekMult = FREQUENCY_MULTIPLIER.perWeek.fourth;
  else if (weekCount <= 5) perWeekMult = FREQUENCY_MULTIPLIER.perWeek.fifth;
  else perWeekMult = FREQUENCY_MULTIPLIER.perWeek.sixthOrMore;

  const combined = perDayMult * perWeekMult;
  const floored =
    combined < FREQUENCY_MULTIPLIER.minOverall
      ? FREQUENCY_MULTIPLIER.minOverall
      : combined;

  const bps = Math.round(floored * 10_000);

  // Pick the most specific cap message
  let messageSlug: RewardMessageSlug | undefined;
  if (perDayMult < 1) {
    messageSlug = "FREQUENCY_FREQUENT_DAY";
  } else if (perWeekMult < 1) {
    messageSlug = "FREQUENCY_FREQUENT_WEEK";
  }

  return { bps, messageSlug };
}
