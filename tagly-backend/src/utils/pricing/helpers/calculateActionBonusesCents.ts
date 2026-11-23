import { ShareInsights, IgPostType } from "../../../generated/prisma/client.js";
import { ACTION_BONUSES } from "../../../constants/rewards/multipliers/ACTION_BONUSES.js";
import { bpsOfCents } from "../../formatting/bpsOfCents.js";

/**
 * Action bonuses deliberately price on the RAW insights reach, NOT the
 * follower-baseline-capped `qualifiedReach` the base price uses (E037 —
 * INTENDED, Matej 2026-08-02). Bonuses reward real engagement actions
 * (profile visits, follows, saves, shares); reach here is only the per-K
 * normalizer for the anti-spam caps and the viral dampener, and a genuine
 * action is worth paying for regardless of how the viewer arrived — including
 * via a business re-share the STORY reach cap deliberately excludes from the
 * base eCPM component. Accepted consequence: a heavily reshared story can
 * price past the 1.5× estimate lock; per the E069 policy the customer is
 * still paid in full and the overage becomes an advertiser receivable.
 * Do NOT "fix" this by passing the capped reach in.
 */
export function calculateActionBonusesCents(share: {
  insights: ShareInsights | null;
  igPostType: IgPostType | null;
}): bigint {
  const ins = share.insights;
  if (!ins) return 0n;

  let reach = 0;
  let counts: Record<string, number> = {};

  // Which action signals count depends on the media type (share.igPostType).
  if (share.igPostType === IgPostType.STORY) {
    reach = Math.trunc(ins.reach ?? ins.views ?? 0);
    counts = {
      profileVisits: ins.profileVisits ?? 0,
      follows: ins.follows ?? 0,
      shares: ins.shares ?? 0,
      replies: ins.replies ?? 0,
    };
  } else if (share.igPostType === IgPostType.POST) {
    reach = Math.trunc(ins.reach ?? ins.views ?? 0);
    counts = {
      profileVisits: ins.profileVisits ?? 0,
      follows: ins.follows ?? 0,
      saves: ins.saved ?? 0,
      shares: ins.shares ?? 0,
      comments: ins.comments ?? 0,
      likes: ins.likes ?? 0,
    };
  } else if (share.igPostType === IgPostType.REEL) {
    reach = Math.trunc(ins.reach ?? ins.views ?? 0);
    counts = {
      saves: ins.saved ?? 0,
      shares: ins.shares ?? 0,
      comments: ins.comments ?? 0,
      likes: ins.likes ?? 0,
    };
  } else {
    return 0n;
  }

  if (reach <= 0) return 0n;

  // Use fractional per-K so small accounts get proportionate credit
  const perK = reach / 1000;
  let sumCents = 0n;

  for (const def of ACTION_BONUSES.actions) {
    const actual = counts[def.key] ?? 0;
    if (actual <= 0) continue;

    const cap = perK * def.capPerKReach;
    if (cap <= 0) continue;

    // Mild diminishing returns for very spammable signals
    const rawCredited = Math.min(actual, cap);
    let credited = rawCredited;

    if (def.key === "likes" || def.key === "comments") {
      credited = Math.sqrt(rawCredited);
    }

    const centsPerAction = Math.round(def.usd * 100);
    if (centsPerAction <= 0) continue;

    sumCents += BigInt(Math.floor(credited * centsPerAction));
  }

  if (sumCents === 0n) return 0n;

  const scale = resolveViralScale(reach);
  const scaleBps = Math.round(scale * 10_000);

  return bpsOfCents(sumCents, scaleBps);
}

function resolveViralScale(reach: number): number {
  for (const tier of ACTION_BONUSES.viralDampenTiers) {
    if (reach <= tier.maxReach) return tier.scale;
  }
  return 1.0;
}
