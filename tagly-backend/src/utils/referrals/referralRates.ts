import {
  REFERRAL_DECAYED_BPS,
  REFERRAL_FULL_REWARD_DURATION_MS,
  REFERRAL_TAKES_BPS,
} from "../../constants/rewards/REFERRAL_TAKES.js";
import { REWARD_TAKES } from "../../constants/rewards/PRICING.js";

const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

/**
 * Effective referral rates, derived from the backend economics. The referrer is
 * paid a cut (`*_REFERRER_TAKE_BPS`) of Tagly's platform fee, and the fee is
 * `TAGLY_PLATFORM_TAKE_BPS` of the gross — so as a fraction of the gross (what a
 * business spends / what a friend makes) the referrer earns
 * `referrerTake × platformTake`. Constant across accounts; computed once here so
 * the client never ships the economics. Full-strength for `boostDurationMonths`,
 * then both rates scale by `decayBps`. Shared by the customer and advertiser
 * referrals hydrators — one copy of the math.
 */
const platformTakeBps = REWARD_TAKES.TAGLY_PLATFORM_TAKE_BPS;
export const REFERRAL_RATES = {
  businessBps: Math.round(
    (REFERRAL_TAKES_BPS.ADVERTISER_REFERRER_TAKE_BPS * platformTakeBps) / 10_000
  ),
  friendBps: Math.round(
    (REFERRAL_TAKES_BPS.CUSTOMER_REFERRER_TAKE_BPS * platformTakeBps) / 10_000
  ),
  boostDurationMonths: Math.round(
    REFERRAL_FULL_REWARD_DURATION_MS / MS_PER_MONTH
  ),
  decayBps: REFERRAL_DECAYED_BPS,
};
