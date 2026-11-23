import { z } from "zod";
import { CentsSchema } from "../../../../core/money";
import { ISODateSchema } from "../../../../core/time";
import { AccountReferralStatusSchema } from "../../../../core/enums";

/**
 * The customer's referral state, returned by `GET /v2/customers/me/referrals`.
 * The code's last-changed timestamp (`referralCodeUpdatedAt`) lives on
 * `CustomerMe` instead — it gates the change-code cooldown in settings.
 */
export const CustomerReferralsSchema = z.object({
  /** The customer's own referral code (others enter this to be referred). */
  code: z.string(),
  status: AccountReferralStatusSchema,
  /** Who referred this customer (their referrer's code + when), or null. */
  referredEvent: z
    .object({
      referrerCode: z.object({ code: z.string() }),
      createdAt: ISODateSchema,
    })
    .nullable(),
  referredBusinessesCount: z.number().int().nonnegative(),
  referredUsersCount: z.number().int().nonnegative(),
  /** Σ of REFERRAL_PAYOUT earnings credited to the customer. */
  totalReferralPayoutsCents: CentsSchema,
  /**
   * Effective referral rates, computed server-side from the (backend-only)
   * referral economics so the client never hardcodes or ships them. Already
   * multiplied through to the gross — i.e. `businessBps`/`friendBps` are the
   * referrer's cut of what a referred business *spends* / a referred friend
   * *makes*, not the raw "% of Tagly's take". Constant across customers.
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
export type CustomerReferralsInput = z.input<typeof CustomerReferralsSchema>;
export type CustomerReferrals = z.infer<typeof CustomerReferralsSchema>;
