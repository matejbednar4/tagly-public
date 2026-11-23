import { CUSTOMER_RATING_MULTIPLIER } from "../../../constants/rewards/CUSTOMER_RATING.js";
import {
  rewardMessageBySlug,
  type RewardMessageSlug,
} from "@tagly/models/shared";

export function calculateCustomerRatingBps({
  customerMultiplierBps,
}: {
  customerMultiplierBps: number;
}): { bps: number; messageSlug?: RewardMessageSlug } {
  const minBps = CUSTOMER_RATING_MULTIPLIER.minBps;
  const maxBps = CUSTOMER_RATING_MULTIPLIER.maxBps;

  let bps = customerMultiplierBps;
  if (bps < minBps) bps = minBps;
  if (bps > maxBps) bps = maxBps;

  let messageSlug: RewardMessageSlug | undefined = undefined;
  const threshold = rewardMessageBySlug.get("ACCOUNT_RATING_LOW")?.threshold;
  if (threshold !== undefined && bps < threshold) {
    messageSlug = "ACCOUNT_RATING_LOW";
  }

  return { bps, messageSlug };
}
