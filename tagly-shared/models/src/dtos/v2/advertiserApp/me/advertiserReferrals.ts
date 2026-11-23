import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";
import { AccountReferralStatusSchema } from "../../../../core/enums";

/**
 * The advertiser's referral state, returned by
 * `GET /v2/advertisers/me/referrals`. Twin of the customer's
 * `CustomerReferrals` — same shape, advertiser-side sources (the payout sum is
 * the advertiser's own `REFERRAL_PAYOUT` budget credits).
 */
export const AdvertiserReferralsSchema = z.object({
  /** The advertiser's own referral code (others enter this to be referred). */
  code: z.string(),
  status: AccountReferralStatusSchema,
  /** Who referred this advertiser (their referrer's code + when), or null. */
  referredEvent: z
    .object({
      referrerCode: z.object({ code: z.string() }),
      createdAt: ISODateSchema,
    })
    .nullable(),
  referredBusinessesCount: z.number().int().nonnegative(),
  referredUsersCount: z.number().int().nonnegative(),
  /** Σ of REFERRAL_PAYOUT earnings credited to the advertiser's budget. */
  totalReferralPayoutsCents: CentsSchema,
  /**
   * Effective referral rates, computed server-side from the (backend-only)
   * referral economics so the client never hardcodes or ships them. Already
   * multiplied through to the gross — i.e. `businessBps`/`friendBps` are the
   * referrer's cut of what a referred business *spends* / a referred friend
   * *makes*, not the raw "% of Tagly's take". Constant across accounts.
   */
  rates: z.object({
    /** Cut of what a referred business spends, full-strength. 1600 = 16%. */
    businessBps: z.number().int().nonnegative(),
    /** Cut of what a referred friend makes, full-strength. 800 = 8%. */
    friendBps: z.number().int().nonnegative(),
    /** Full-strength window (months); after it, both rates scale by `decayBps`. */
    boostDurationMonths: z.number().int().positive(),
    /** Multiplier applied to both rates after the boost window. 5000 = 50% (halves). */
    decayBps: z.number().int().nonnegative(),
  }),
});

/** Raw hydrator shape (accepts `Date`/`bigint` before coercion). */
export type AdvertiserReferralsInput = z.input<typeof AdvertiserReferralsSchema>;
export type AdvertiserReferrals = z.infer<typeof AdvertiserReferralsSchema>;
