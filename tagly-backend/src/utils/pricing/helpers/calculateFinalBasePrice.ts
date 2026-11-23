import { ShareInsights, IgPostType } from "../../../generated/prisma/client.js";
import { BASE_ECPMS } from "../../../constants/rewards/ECPM.js";
import { capReachAtFollowerBaseline } from "./capReachAtFollowerBaseline.js";

export function calculateFinalBasePrice(share: {
  insights: ShareInsights | null;
  igPostType: IgPostType | null;
  // The snapshot captured for this share; its followerCount is the baseline the
  // STORY reach cap is measured against. Non-null in the settlement path (the
  // caller guards on it); typed nullable so we degrade to a 0 baseline (→ floor)
  // rather than throw.
  instagramSnapshot: { followerCount: number } | null;
}): {
  basePriceCents: bigint;
  qualifiedReach: number;
  appliedECPMCents: number;
} {
  let qualifiedReach = 0;
  let appliedECPMCents = 0;

  const ins = share.insights;
  const followerCount = share.instagramSnapshot?.followerCount ?? 0;

  // Media type is read from share.igPostType (the authoritative discriminator
  // the igInsights worker gates on). Use reach; if no reach, fall back to views.
  if (ins) {
    const reach = ins.reach ?? 0;
    const views = ins.views ?? 0;
    const qr = reach > 0 ? reach : views;

    if (share.igPostType === IgPostType.STORY) {
      // Stories are seen mostly by followers; a business re-sharing the story
      // can inflate reach far past the customer's own audience. Cap payable
      // reach at followerCount × multiplier so the business isn't billed for
      // reach it generated. Reels/posts are NOT capped (they legitimately
      // exceed follower reach via the explore page).
      qualifiedReach = capReachAtFollowerBaseline(qr, followerCount);
      appliedECPMCents = BASE_ECPMS.IG_STORY_CENTS;
    } else if (share.igPostType === IgPostType.REEL) {
      qualifiedReach = qr;
      appliedECPMCents = BASE_ECPMS.IG_REEL_CENTS;
    } else if (share.igPostType === IgPostType.POST) {
      qualifiedReach = qr;
      appliedECPMCents = BASE_ECPMS.IG_POST_CENTS;
    }
  }

  const basePriceCents =
    (BigInt(qualifiedReach) * BigInt(appliedECPMCents)) / 1000n;

  return { basePriceCents, qualifiedReach, appliedECPMCents };
}
